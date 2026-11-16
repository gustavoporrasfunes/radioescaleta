import { authService } from './services/authService.js?v=3';
import { dbService } from './services/dbService.js?v=8';

document.addEventListener('DOMContentLoaded', () => {
    const btnLogin = document.getElementById('btnLogin');
    const btnLogin2 = document.getElementById('btnLogin2');
    const btnScrollToEmail = document.getElementById('btnScrollToEmail');
    const emailLoginForm = document.getElementById('emailLoginForm');
    const loginEmailInput = document.getElementById('loginEmail');
    const loginPasswordInput = document.getElementById('loginPassword');
    const btnShowRegister = document.getElementById('btnShowRegister');
    const btnForgotPassword = document.getElementById('btnForgotPassword');
    const loginSection = document.getElementById('loginSection');

    let isRegistering = false;

    // 1. Redirigir si ya está autenticado
    authService.onAuthStateChanged(async (user) => {
        if (user && !isRegistering) {
            window.location.href = 'dashboard.html';
        } else if (!user) {
            if (loginSection) loginSection.classList.remove('hidden');
        }
    });

    // 2. Acceso con Google
    const doGoogleLogin = async () => {
        try {
            await authService.login();
            // onAuthStateChanged redirige automáticamente
        } catch (error) {
            console.error("Error login Google:", error);
            if (error.code === 'auth/popup-closed-by-user') {
                return; // El usuario simplemente cerró la ventana emergente
            }

            const errorMsg = error.message || '';
            const isInstitutionalBlock = errorMsg.includes('admin') || errorMsg.includes('restricted') || errorMsg.includes('blocked');

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'warning',
                    title: 'Acceso con Google bloqueado',
                    html: `Si tu cuenta institucional de educación (<b>@g.educaand.es</b>) tiene restringido el acceso a aplicaciones de terceros por tu administración, <b>puedes acceder con tu correo y contraseña</b>.<br><br>💡 Haz clic en <b>'¿Primer acceso? Crea tu contraseña'</b> para configurar tu acceso directo.`,
                    confirmButtonColor: '#f06292',
                    confirmButtonText: 'Entendido'
                });
            } else {
                alert("Si Google bloquea tu cuenta institucional, utiliza el acceso por correo y contraseña.");
            }
        }
    };

    if (btnLogin) btnLogin.addEventListener('click', doGoogleLogin);
    if (btnLogin2) btnLogin2.addEventListener('click', doGoogleLogin);

    // 3. Scroll rápido a formulario de correo
    if (btnScrollToEmail) {
        btnScrollToEmail.addEventListener('click', () => {
            if (emailLoginForm) {
                emailLoginForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    if (loginEmailInput) loginEmailInput.focus();
                }, 400);
            }
        });
    }

    // 4. Iniciar sesión con Correo y Contraseña
    if (emailLoginForm) {
        emailLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginEmailInput.value.trim();
            const password = loginPasswordInput.value;
            if (!email || !password) return;

            const btn = document.getElementById('btnEmailLogin');
            const origHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';
            btn.disabled = true;

            try {
                await authService.loginWithEmail(email, password);
                // onAuthStateChanged redirige automáticamente al dashboard
            } catch (error) {
                console.error("Error login correo:", error);
                let msg = "No se ha podido iniciar sesión con esas credenciales.";
                if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    msg = `El correo o la contraseña no son correctos.<br><br>💡 Si es la primera vez que entras, pulsa en <b>'¿Primer acceso? Crea tu contraseña'</b>.`;
                } else if (error.code === 'auth/operation-not-allowed') {
                    msg = `El acceso con correo y contraseña aún no está activado en la consola de Firebase.<br><br><small>El administrador debe activar el proveedor <b>'Correo electrónico/contraseña'</b> en Firebase Console &gt; Authentication.</small>`;
                } else if (error.code === 'auth/too-many-requests') {
                    msg = `Demasiados intentos fallidos. Por seguridad, espera unos minutos o utiliza el enlace de recuperación de contraseña.`;
                } else if (error.code === 'auth/invalid-email') {
                    msg = `El formato del correo electrónico no es válido.`;
                }

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'No se pudo iniciar sesión',
                        html: msg,
                        confirmButtonColor: '#f06292'
                    });
                } else {
                    alert(msg.replace(/<[^>]*>/g, ''));
                }
            } finally {
                btn.innerHTML = origHtml;
                btn.disabled = false;
            }
        });
    }

    // 5. Modal: Primer acceso / Crear contraseña
    if (btnShowRegister) {
        btnShowRegister.addEventListener('click', async () => {
            if (typeof Swal === 'undefined') return;

            const currentTypedEmail = loginEmailInput ? loginEmailInput.value.trim() : '';

            const { value: formValues } = await Swal.fire({
                title: 'Primer acceso: Crea tu contraseña',
                html: `
                    <p style="font-size:14px; color:#555; margin-bottom:16px; line-height:1.5;">
                        Introduce el correo con el que te ha invitado tu docente o centro educativo y elige una contraseña para acceder.
                    </p>
                    <div style="text-align:left; display:flex; flex-direction:column; gap:10px;">
                        <label style="font-size:12px; font-weight:bold; color:#555;">Correo electrónico invitado:</label>
                        <input id="swalRegEmail" type="email" class="swal2-input" placeholder="ej. usuario@g.educaand.es" value="${currentTypedEmail}" style="margin:0; width:100%; box-sizing:border-box;">

                        <label style="font-size:12px; font-weight:bold; color:#555; margin-top:6px;">Nombre y apellidos (opcional):</label>
                        <input id="swalRegName" type="text" class="swal2-input" placeholder="Tu nombre completo" style="margin:0; width:100%; box-sizing:border-box;">

                        <label style="font-size:12px; font-weight:bold; color:#555; margin-top:6px;">Nueva contraseña (mínimo 6 caracteres):</label>
                        <input id="swalRegPass1" type="password" class="swal2-input" placeholder="••••••••" style="margin:0; width:100%; box-sizing:border-box;">

                        <label style="font-size:12px; font-weight:bold; color:#555; margin-top:6px;">Repite la contraseña:</label>
                        <input id="swalRegPass2" type="password" class="swal2-input" placeholder="••••••••" style="margin:0; width:100%; box-sizing:border-box;">
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: '<i class="fa-solid fa-check"></i> Activar y Entrar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#00acc1',
                cancelButtonColor: '#999',
                preConfirm: () => {
                    const email = document.getElementById('swalRegEmail').value.trim();
                    const name = document.getElementById('swalRegName').value.trim();
                    const pass1 = document.getElementById('swalRegPass1').value;
                    const pass2 = document.getElementById('swalRegPass2').value;

                    if (!email) {
                        Swal.showValidationMessage('Introduce tu correo electrónico');
                        return false;
                    }
                    if (!email.includes('@') || !email.includes('.')) {
                        Swal.showValidationMessage('El formato de correo no es válido');
                        return false;
                    }
                    if (!pass1 || pass1.length < 6) {
                        Swal.showValidationMessage('La contraseña debe tener al menos 6 caracteres');
                        return false;
                    }
                    if (pass1 !== pass2) {
                        Swal.showValidationMessage('Las contraseñas no coinciden');
                        return false;
                    }

                    return { email, name, pass: pass1 };
                }
            });

            if (!formValues) return;

            isRegistering = true;
            Swal.fire({
                title: 'Creando cuenta...',
                html: 'Configurando tus credenciales de acceso...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                // 1. Crear el usuario en Firebase Authentication primero (no requiere permisos de Firestore)
                await authService.registerWithEmail(formValues.email, formValues.pass, formValues.name);

                // 2. Ahora que el usuario ya está autenticado (request.auth != null),
                // comprobamos con total permiso si su email fue previamente invitado por un docente o centro
                const isInvited = await dbService.isEmailInvited(formValues.email);

                if (!isInvited) {
                    // Si no estaba invitado, cancelamos y eliminamos el usuario para no dejar rastro
                    try {
                        const currentUser = authService.getUser();
                        if (currentUser && typeof currentUser.delete === 'function') {
                            await currentUser.delete();
                        }
                    } catch (delErr) {
                        console.warn("Aviso eliminando usuario no invitado:", delErr);
                    }
                    await authService.logout();
                    isRegistering = false;

                    Swal.fire({
                        icon: 'warning',
                        title: 'Correo no autorizado',
                        html: `El correo <b>${formValues.email}</b> no figura en la lista de usuarios invitados por ningún docente o centro educativo.<br><br>Pide a tu docente o al administrador que te dé de alta primero.`,
                        confirmButtonColor: '#f06292'
                    });
                    return;
                }

                // 3. Usuario invitado y autorizado: ¡éxito!
                Swal.fire({
                    icon: 'success',
                    title: '¡Acceso creado con éxito!',
                    text: 'Entrando a Radioescaleta...',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    isRegistering = false;
                    window.location.href = 'dashboard.html';
                });

            } catch (err) {
                isRegistering = false;
                console.error("Error al registrar contraseña:", err);
                let errHtml = "No se pudo crear la cuenta.";
                if (err.code === 'auth/email-already-in-use') {
                    errHtml = `Este correo (<b>${formValues.email}</b>) ya tiene una contraseña configurada en Radioescaleta.<br><br>Inicia sesión directamente con tu contraseña en la portada o pulsa en <b>'¿Olvidaste tu contraseña?'</b> si necesitas restablecerla.`;
                } else if (err.code === 'auth/operation-not-allowed') {
                    errHtml = `El acceso con correo y contraseña aún no está activado en Firebase Authentication.<br><br><small>El administrador debe activar el proveedor <b>'Correo electrónico/contraseña'</b> en Firebase Console &gt; Authentication.</small>`;
                } else if (err.code === 'auth/weak-password') {
                    errHtml = `La contraseña es demasiado débil. Utiliza al menos 6 caracteres.`;
                } else if (err.code === 'auth/invalid-email') {
                    errHtml = `El formato del correo electrónico no es válido.`;
                } else if (err.message) {
                    errHtml = err.message;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo completar el registro',
                    html: errHtml,
                    confirmButtonColor: '#f06292'
                });
            }
        });
    }

    // 6. Recuperar contraseña
    if (btnForgotPassword) {
        btnForgotPassword.addEventListener('click', async () => {
            if (typeof Swal === 'undefined') return;

            const currentTypedEmail = loginEmailInput ? loginEmailInput.value.trim() : '';

            const { value: email } = await Swal.fire({
                title: '¿Olvidaste tu contraseña?',
                text: 'Introduce tu correo y te enviaremos un enlace oficial para restablecerla:',
                input: 'email',
                inputValue: currentTypedEmail,
                inputPlaceholder: 'tu-correo@g.educaand.es',
                showCancelButton: true,
                confirmButtonText: 'Enviar enlace',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#00acc1',
                inputValidator: (val) => {
                    if (!val || !val.includes('@')) {
                        return 'Introduce un correo válido';
                    }
                }
            });

            if (!email) return;

            try {
                Swal.fire({
                    title: 'Enviando correo...',
                    didOpen: () => { Swal.showLoading(); }
                });

                await authService.resetPassword(email);

                Swal.fire({
                    icon: 'success',
                    title: '¡Correo enviado!',
                    html: `Hemos enviado las instrucciones para restablecer tu contraseña a <b>${email}</b>.<br><br><small style="color:#666;">Revisa también tu carpeta de spam o correo no deseado si tarda unos minutos en llegar.</small>`,
                    confirmButtonColor: '#00acc1'
                });
            } catch (err) {
                console.error("Error al restablecer contraseña:", err);
                let errHtml = "No se pudo enviar el correo de recuperación.";
                if (err.code === 'auth/user-not-found') {
                    errHtml = `No hay ninguna cuenta registrada con el correo <b>${email}</b>.`;
                } else if (err.message) {
                    errHtml = err.message;
                }
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    html: errHtml,
                    confirmButtonColor: '#f06292'
                });
            }
        });
    }
});
