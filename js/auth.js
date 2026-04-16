import { auth } from './supabase.js'

const user = await auth.getUser()
if (user) window.location.href = 'dashboard.html'

document.getElementById('showRegisterBtn').addEventListener('click', () => {
    document.getElementById('login-form').classList.add('d-none')
    document.getElementById('register-form').classList.remove('d-none')
    document.getElementById('loginError').classList.add('d-none')
})

document.getElementById('showLoginBtn').addEventListener('click', () => {
    document.getElementById('register-form').classList.add('d-none')
    document.getElementById('login-form').classList.remove('d-none')
    document.getElementById('registerError').classList.add('d-none')
})

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const { error } = await auth.signIn(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value)
    if (error) {
        document.getElementById('loginError').textContent = error.message
        document.getElementById('loginError').classList.remove('d-none')
    } else { window.location.href = 'dashboard.html' }
})

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    const { error } = await auth.signUp(
        document.getElementById('registerEmail').value, document.getElementById('registerPassword').value,
        document.getElementById('registerName').value, document.getElementById('registerCompany').value,
        document.getElementById('registerCurrency').value
    )
    if (error) {
        document.getElementById('registerError').textContent = error.message
        document.getElementById('registerError').classList.remove('d-none')
    } else {
        document.getElementById('registerSuccess').textContent = 'Account created! Check your email.'
        document.getElementById('registerSuccess').classList.remove('d-none')
        setTimeout(() => window.location.reload(), 2000)
    }
})