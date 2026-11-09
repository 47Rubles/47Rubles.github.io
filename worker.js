/**
 * Cloudflare Worker для 47OS 98
 * Маршрутизирует API запросы к GitHub Issues и отдает статические файлы сайта.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Маршрут шлюза гостевой книги / лога нарушителей
    if (url.pathname === "/api" || url.pathname === "/api/") {
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Поддерживается только метод POST" }), {
          status: 405,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        });
      }

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

        const token = env.GITHUB_TOKEN;
        if (!token) {
          return new Response(JSON.stringify({ 
            error: "GITHUB_TOKEN не настроен в переменных Cloudflare Worker" 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }

        const now = new Date();
        const dateRu = now.toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
        const issueTitle = `Запись нарушителя [${dateRu}]`;
        const issueBody = `### Сообщение из 47OS 98:\n\n> ${message.replace(/\n/g, '\n> ')}\n\n---\n*Отправлено через шлюз 47OS (${dateRu} МСК)*`;

        const ghResponse = await fetch("https://api.github.com/repos/47Rubles/47Rubles.github.io/issues", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/vnd.github+json",
            "User-Agent": "47OS-Gateway",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: issueTitle,
            body: issueBody,
            labels: ["гостевая книга", "47os"]
          }),
        });

        if (!ghResponse.ok) {
          const errDetails = await ghResponse.text();
          return new Response(JSON.stringify({
            error: "GitHub API вернул ошибку при создании Issue",
            details: errDetails
          }), {
            status: ghResponse.status,
            headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
          });
        }

        const issueData = await ghResponse.json();
        return new Response(JSON.stringify({
          success: true,
          issue_number: issueData.number,
          html_url: issueData.html_url,
          created_at: issueData.created_at
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        });

      } catch (err) {
        return new Response(JSON.stringify({
          error: "Внутренняя ошибка шлюза",
          message: err.message
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
        });
      }
    }

    // 2. Для всех остальных путей отдаем статические файлы сайта
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not found", { status: 404 });
  }
};
