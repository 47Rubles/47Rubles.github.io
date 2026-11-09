/**
 * Cloudflare Worker для 47OS 98
 * Обрабатывает реестр «Лог нарушителей» через Cloudflare KV и отдает статические файлы сайта.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Маршрут реестра нарушителей / гостевой книги (/api)
    if (url.pathname === "/api" || url.pathname === "/api/") {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

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
