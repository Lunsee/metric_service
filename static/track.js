(function () {
    const publicKey = document.currentScript.getAttribute("data-public-key");
    const startTime = Date.now(); // Время начала сессии

    function sendEvent(eventType, extraData = {}) {
        const payload = {
            public_key: publicKey,
            event: eventType,
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            ...extraData
        };

        console.log("[Analytics] Sending event:", payload);

        fetch("http://localhost:8080/api/collect", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => console.log("[Analytics] Server response:", data))
        .catch(error => console.error("[Analytics] Error sending event:", error));
    }

    sendEvent("page_view");

   document.addEventListener("click", (e) => {
        const target = e.target;

        // Клик по кнопке
        if (target.tagName === 'BUTTON') {
            sendEvent("button_click", {
                event_data: {
                    button_id: target.id || null,
                    button_text: target.textContent.trim(),
                    class_list: target.className || null
                }
            });
        }
        // Клик по ссылке
        else if (target.tagName === 'A') {
            sendEvent("link_click", {
                event_data: {
                    href: target.href,
                    link_text: target.textContent.trim()
                }
            });
        }
        // Остальные клики (по желанию можно отключить)
        else {
            sendEvent("generic_click", {
                event_data: {
                    element: target.tagName,
                    coordinates: { x: e.clientX, y: e.clientY }
                }
            });
        }
    });

document.addEventListener("submit", function(e) {
    // Отправляем только событие form_click_send
    sendEvent("form_click_send");

});

    // Отправляем событие при уходе со страницы
    window.addEventListener("beforeunload", () => {
        const durationMs = Date.now() - startTime;

        // Так как fetch не успеет выполниться синхронно, используем navigator.sendBeacon
        const payload = {
            public_key: publicKey,
            event: "time_spent",
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            referrer: document.referrer,
            event_data: {
                duration_ms: durationMs
            }
        };

        navigator.sendBeacon(
            "http://localhost:8080/api/collect",
            new Blob([JSON.stringify(payload)], { type: "application/json" })
        );
    });
})();
