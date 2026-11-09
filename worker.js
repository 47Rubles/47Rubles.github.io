/**
 * Cloudflare Worker для 47OS 98
 * Обрабатывает реестр «Лог нарушителей» через Cloudflare KV и отдает статические файлы сайта.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Общие CORS-заголовки
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 1. Маршрут MBTL Remote Play (/api/mbtl/*)
    if (url.pathname.startsWith("/api/mbtl")) {
      if (!env.GUESTBOOK_KV) {
        return new Response(JSON.stringify({ error: "База данных KV не привязана" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        });
      }

      const subpath = url.pathname.replace("/api/mbtl", "").replace(/^\//, "");

      // 1.1 GET /api/mbtl/status - Статус хоста и очереди
      if (subpath === "status" || subpath === "") {
        try {
          const rawState = await env.GUESTBOOK_KV.get("mbtl_host_state", "json");
          const now = Date.now();
          const isAlive = rawState && (now - (rawState.last_seen || 0) < 15000);

          return new Response(JSON.stringify({
            online: Boolean(isAlive && rawState.online),
            is_blocked: rawState?.is_blocked ?? false,
            active_player: isAlive ? (rawState.active_player || null) : null,
            queue_count: isAlive ? (rawState.queue_count || 0) : 0,
            last_seen: rawState?.last_seen || 0
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      // 1.2 POST /api/mbtl/heartbeat - Пинг от хост-скрипта на ПК
      if (subpath === "heartbeat" && request.method === "POST") {
        try {
          const body = await request.json().catch(() => ({}));
          const state = {
            online: Boolean(body.online),
            is_blocked: Boolean(body.is_blocked),
            active_player: body.active_player || null,
            queue_count: Number(body.queue_count || 0),
            last_seen: Date.now()
          };
          await env.GUESTBOOK_KV.put("mbtl_host_state", JSON.stringify(state), { expirationTtl: 60 });
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      // 1.3 POST /api/mbtl/join - Запрос на подключение гостя (SDP Offer)
      if (subpath === "join" && request.method === "POST") {
        try {
          const body = await request.json().catch(() => ({}));
          const { clientId, offer } = body;
          if (!clientId || !offer) {
            return new Response(JSON.stringify({ error: "clientId and offer required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
            });
          }

          // Сохраняем оффер клиента на 120 секунд
          await env.GUESTBOOK_KV.put(`mbtl_offer_${clientId}`, JSON.stringify(offer), { expirationTtl: 120 });

          // Добавляем clientId в список ожидающих
          let pending = await env.GUESTBOOK_KV.get("mbtl_pending_clients", "json") || [];
          if (!pending.includes(clientId)) {
            pending.push(clientId);
            await env.GUESTBOOK_KV.put("mbtl_pending_clients", JSON.stringify(pending), { expirationTtl: 120 });
          }

          return new Response(JSON.stringify({ success: true, queued: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      // 1.4 GET /api/mbtl/host_pull - Хост забирает новые офферы клиентов
      if (subpath === "host_pull" && request.method === "GET") {
        try {
          let pending = await env.GUESTBOOK_KV.get("mbtl_pending_clients", "json") || [];
          const offers = [];

          for (const clientId of pending) {
            const offer = await env.GUESTBOOK_KV.get(`mbtl_offer_${clientId}`, "json");
            if (offer) {
              offers.push({ clientId, offer });
            }
          }

          // Очищаем список забранных
          if (pending.length > 0) {
            await env.GUESTBOOK_KV.put("mbtl_pending_clients", JSON.stringify([]), { expirationTtl: 120 });
          }

          return new Response(JSON.stringify({ offers }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      // 1.5 POST /api/mbtl/host_answer - Хост отправляет SDP Answer клиенту
      if (subpath === "host_answer" && request.method === "POST") {
        try {
          const body = await request.json().catch(() => ({}));
          const { clientId, answer, role } = body;
          if (!clientId || !answer) {
            return new Response(JSON.stringify({ error: "clientId and answer required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
            });
          }

          await env.GUESTBOOK_KV.put(`mbtl_answer_${clientId}`, JSON.stringify({ answer, role: role || "spectator" }), { expirationTtl: 120 });
          // Удаляем уже обработанный оффер
          await env.GUESTBOOK_KV.delete(`mbtl_offer_${clientId}`);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      // 1.6 GET /api/mbtl/client_pull?clientId=... - Клиент проверяет ответ хоста
      if (subpath === "client_pull" && request.method === "GET") {
        try {
          const clientId = url.searchParams.get("clientId");
          if (!clientId) {
            return new Response(JSON.stringify({ error: "clientId required" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
            });
          }

          const answerData = await env.GUESTBOOK_KV.get(`mbtl_answer_${clientId}`, "json");
          if (!answerData) {
            return new Response(JSON.stringify({ ready: false }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
            });
          }

          return new Response(JSON.stringify({ ready: true, ...answerData }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      return new Response(JSON.stringify({ error: "Неизвестный эндпоинт mbtl" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 2. Маршрут реестра нарушителей / гостевой книги (/api)
    if (url.pathname === "/api" || url.pathname === "/api/") {

      // Проверяем наличие привязки KV базы данных
      if (!env.GUESTBOOK_KV) {
        return new Response(JSON.stringify({ 
          error: "База данных GUESTBOOK_KV ещё не привязана в настройках Cloudflare Worker (Settings -> Variables -> KV Namespace Bindings)" 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        });
      }

      // GET: Загрузка списка всех сообщений нарушителей
      if (request.method === "GET") {
        try {
          const messages = await env.GUESTBOOK_KV.get("messages", "json") || [];
          return new Response(JSON.stringify(messages), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: "Ошибка чтения из базы данных", details: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      // POST: Добавление новой записи с присвоением ID из БД
      if (request.method === "POST") {
        try {
          const body = await request.json().catch(() => ({}));
          const message = (body.message || "").trim();

          if (!message) {
            return new Response(JSON.stringify({ error: "Сообщение не может быть пустым" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
            });
          }

          if (message.length > 500) {
            return new Response(JSON.stringify({ error: "Сообщение слишком длинное (максимум 500 символов)" }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
            });
          }

          // 1. Получаем и увеличиваем порядковый ID из базы
          const rawCounter = await env.GUESTBOOK_KV.get("counter");
          let counter = rawCounter ? parseInt(rawCounter, 10) : 0;
          counter += 1;
          await env.GUESTBOOK_KV.put("counter", counter.toString());

          // 2. Формируем запись: вместо чужих ников присваиваем "Нарушитель #ID"
          const now = new Date();
          const dateRu = now.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
          const newEntry = {
            id: counter,
            author: `Нарушитель #${counter}`,
            text: message,
            date: dateRu
          };

          // 3. Сохраняем в список сообщений (храним последние 300 записей)
          let messages = await env.GUESTBOOK_KV.get("messages", "json") || [];
          messages.unshift(newEntry);
          if (messages.length > 300) {
            messages = messages.slice(0, 300);
          }
          await env.GUESTBOOK_KV.put("messages", JSON.stringify(messages));

          return new Response(JSON.stringify({
            success: true,
            entry: newEntry
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });

        } catch (err) {
          return new Response(JSON.stringify({
            error: "Ошибка сохранения в базу данных",
            message: err.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }
      }

      return new Response(JSON.stringify({ error: "Метод не поддерживается" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    // 2. Для всех остальных путей отдаем статические файлы сайта
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
