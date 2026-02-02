# Guia de Despliegue en Vercel

He preparado tu código localmente (Git inicializado y commit realizado). Ahora sigue estos pasos para poner tu web en producción.

## 1. GitHub
1. Ve a [github.com/new](https://github.com/new) y crea un nuevo repositorio (mantenlo **Privado** para seguridad).
2. Copia la URL del repositorio (termina en `.git`).
3. Ejecuta estos comandos en tu terminal para subir el código:
   ```bash
   git remote add origin <PEGA_AQUI_LA_URL_DE_TU_REPO>
   git branch -M main
   git push -u origin main
   ```

## 2. Vercel
1. Ve a [vercel.com/new](https://vercel.com/new) e importa el repositorio que acabas de crear.
2. En la configuración del proyecto, despliega la sección **Environment Variables**.
3. Añade las siguientes variables (copia los valores exactos de tu archivo `.env.local`):

| Nombre (Key) | Valor (Value) |
|--------------|---------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | *Copia el valor de tu .env.local* |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `rr-performance-3c79d.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `rr-performance-3c79d` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `rr-performance-3c79d.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `624071275580` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:624071275580:web:91f452a84edb5d4ec93f39` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-746788D92Y` |

4. Pulsa **Deploy**.

## 3. Siguiente Paso
Una vez termine el despliegue, Vercel te dará una URL (ej. `https://tu-app.vercel.app`).

**Copia esa URL y pégala aquí en el chat.** 
Yo me encargaré de configurar la App Móvil (Capacitor) para que apunte a esa dirección definitiva.
