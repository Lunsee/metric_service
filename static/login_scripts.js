
$(document).ready(function() {

    $('#loginBtn').click(login);
    $('#registerBtn').click(register);
    $('#showRegForm').click(showSignup);
    $('#showLoginForm').click(showLogin);
    function showSignup() {
        $('#loginForm').removeClass('active');
        $('#signupForm').addClass('active');
        document.title = "Register";
    }

    function showLogin() {
        $('#signupForm').removeClass('active');
        $('#loginForm').addClass('active');
        document.title = "Sign in";
    }

    function register() {
        console.log("register...")
        const username = $('#newUsername').val();
        const password = $('#newPassword').val();
        console.log("username:",username)
        console.log("password:",password)

    $.ajax({
        url: '/auth/register',
        type: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
        username: username,
        password: password
    }),
        success: function(response) {
            console.log('Request from server:', response);
            showLogin()
            alert("Register successfully: " + username);
        },
        error: function(xhr) {
            console.error('Error:', xhr.responseJSON);
            const errorDetail = xhr.responseJSON?.detail || "Неизвестная ошибка";
            alert("Ошибка регистрации: " + errorDetail);
        }
    });
    }

    function login() {
        console.log("login...")
        const username = $('#username').val();
        const password = $('#password').val();

        const formData = new FormData();
        formData.append("username", username);
        formData.append("password", password);
        console.log("username:",username)
        console.log("password:",password)
        console.log(" formData:", formData)
        $.ajax({
        url: '/auth/token',
        type: 'POST',
        data: formData,
        processData: false,
        contentType: false,
        success: function(response) {
            console.log('Request from server:', response);
            document.cookie = `access_token=${response.access_token}; path=/; Secure; SameSite=Strict`;
            document.cookie = `refresh_token=${response.refresh_token}; path=/; Secure; SameSite=Strict`;
            alert("Login success!");
            window.location.href = "/dashboard";

        },
        error: function(xhr, status, error) {
            console.error("Login failed:", xhr.responseText);
            alert("Login failed! Please check your username and password.");
        }
    });
    }




});
