// Флаг: была ли уже попытка обновления токена
let hasAttemptedRefresh = false;
let refreshPromise = null;
let isRefreshing = false;

// Проверка авторизации
export async function checkAuth() {
    console.log("checkAuth...");
    const token = document.cookie.split('; ').find(row => row.startsWith('access_token='));

    if (token) {
        const tokenValue = token.split('=')[1];

        try {
            const response = await fetch('/auth/access-token-login', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${tokenValue}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (!data.user) { //критерий валидности
                    throw new Error('Invalid response payload');
                }
                console.log('User is authenticated:', data);
                return true;
            } else {
                throw new Error('Failed to authenticate');
            }
        } catch (error) {
            console.error('Failed to authenticate:', error);

            // Только одна попытка обновления токена
            if (!hasAttemptedRefresh) {
                hasAttemptedRefresh = true;
                console.log("Try to take access token with refresh")
                const refreshed = await refreshToken();
                if (refreshed) {
                    return await checkAuth(); // Попробуем проверить авторизацию с новым токеном
                }else{
                    console.warn("Failed to refresh token, redirecting to login...");
                   // showLogin();
                    return false;
                }

            } else {
                console.warn("Second failed attempt. Redirecting to login.");
                //showLogin();
                return false;
            }
            //return false;
        }

    } else {
        // access_token не найден
        console.log("No access token found.");
        if (window.location.pathname !== '/login') {
            //showLogin();
        } else {
            console.log("You are already on the login page.");
        }
        return false;
    }
}

// Обновление access_token через refresh_token
export async function refreshToken() {
    console.log("refreshToken called...");

    try {
        const response = await fetch('/auth/refresh', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                //  refresh_token
            }
        });

        const data = await response.json();
        if (response.ok) {
            console.log('Token refreshed:', data);

            // Обновляем access_token
            document.cookie = `access_token=${data.access_token}; path=/; max-age=900 ; Secure; SameSite=Strict`;

            hasAttemptedRefresh = false;
            return true;
           // checkAuth();
        } else {
            throw new Error('Failed to refresh token');
        }
    } catch (error) {
        console.error('Failed to refresh token:', error);
        //showLogin();
        return false;
    }
}

// Перенаправление на страницу логина
function showLogin() {
    window.location.href = '/login';
}
