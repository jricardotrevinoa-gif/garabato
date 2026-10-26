# Garabato ✏️

Juego de dibujar y adivinar para jugar en casa. La laptop se proyecta y muestra la pizarra; cada quien juega desde su celular.

## Opción fácil: jugar desde internet (sin instalar nada)

Si este proyecto está en tu GitHub, puedes publicarlo gratis en [Render](https://render.com):

1. Entra a render.com con tu cuenta de GitHub.
2. **New → Blueprint** y elige el repositorio `garabato`. Render lee `render.yaml` y lo configura solo.
3. Al terminar te da un link tipo `https://garabato-xxxx.onrender.com`.
4. Abre ese link en la laptop (es la pantalla). Los celulares escanean el QR; no importa qué red usen.

El plan gratis "se duerme" si nadie lo usa un rato: la primera vez que lo abras puede tardar ~1 minuto en despertar.
Cualquiera con el link puede entrar, y solo hay una partida a la vez.

## Opción en casa: correrlo en la laptop

### Lo que necesitas (una sola vez)

Instala **Node.js** en la laptop (versión LTS): https://nodejs.org

### Para jugar

1. Descomprime esta carpeta en la laptop.
2. Abre el juego:
   - **Windows:** doble clic en `iniciar-windows.bat`
   - **Mac:** clic derecho en `iniciar-mac.command` → Abrir (la primera vez macOS pide confirmar)
   - **O desde la terminal:** entra a la carpeta y escribe `node server.js`
3. Se abre la pantalla del juego en el navegador. Ponla en pantalla completa con la tecla **F** y proyéctala.
4. Que todos conecten su celular **al mismo Wi-Fi que la laptop** y escaneen el código QR.
5. Cuando estén todos, dale **¡A jugar!** en la laptop.

Para cerrar el juego, cierra la ventana negra (o `Ctrl + C`).

## Probarlo tú solo

Con el juego abierto en la laptop, abre 2 o 3 pestañas más con `http://localhost:3000/jugar?prueba`.
Cada pestaña cuenta como un jugador distinto. Ponles nombres, dale **¡A jugar!** en la pantalla
y ve cambiando de pestaña para dibujar y adivinar. También puedes sumar tu celular con el QR.

## Cómo se juega

- En cada turno a alguien le toca dibujar: elige una de tres palabras en su celular y la dibuja con el dedo.
- El dibujo aparece en vivo en la pantalla. Los demás escriben sus intentos en su celular.
- Más rápido = más puntos. Las palabras difíciles valen más. Quien dibuja gana puntos por cada persona que adivina.
- Si alguien escribe algo casi correcto, le avisa "¡Casi!" sin revelar la palabra en la pantalla.
- Con el tiempo aparecen letras de pista.

## Si algo falla

- **Los celulares no abren la página:** revisa que estén en el mismo Wi-Fi (no en datos). Si la laptop pregunta si permites conexiones de Node, acepta. Algunas redes de oficina u hotel bloquean que los equipos se vean entre sí; en ese caso usa el hotspot de un celular y conecta ahí la laptop y a todos.
- **El QR muestra una dirección rara:** la ventana negra lista otras direcciones posibles; prueba esas en el celular.
- **Alguien se desconecta:** que vuelva a abrir la página; recupera su lugar y sus puntos. Si se cae quien dibuja, el turno espera 15 segundos.

## Personalizar

- Palabras: edita `palabras.js` (fácil, medio y difícil).
- Tiempos de elegir y de revelación: al inicio de `server.js`.
