const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const introVideo = document.getElementById('intro-video');
const startScreen = document.getElementById('start-screen');
const mobileControls = document.getElementById('mobile-controls');

// Definición de resolución base interna
canvas.width = 854;
canvas.height = 480;

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Pasar de video a menú
introVideo.addEventListener('ended', () => {
    introVideo.style.display = 'none';
    startScreen.style.display = 'flex';
});

// Forzado en caso de bloqueo de autoplay
document.addEventListener('click', () => {
    if (introVideo.paused && introVideo.style.display !== 'none') {
        introVideo.play().catch(() => {
            introVideo.style.display = 'none';
            startScreen.style.display = 'flex';
        });
    }
}, { once: true });

// Estructura de Spritesheets
const sprites = {
    king: new Image(),
    empanada: new Image(),
    shop: new Image()
};
sprites.king.src = 'characters/King-orange.png';
sprites.empanada.src = 'characters/Evil-empanada.png';
sprites.shop.src = 'characters/shop.png';

// Mapeos obtenidos directamente de tus archivos XML
const kingXML = {
    idle: { x: 1104, y: 567, w: 180, h: 562 },
    jump: { x: 756, y: 616, w: 312, h: 616 },
    walk: [
        { x: 1284, y: 561, w: 178, h: 558 },
        { x: 1104, y: 0, w: 180, h: 567 },
        { x: 1284, y: 0, w: 180, h: 561 },
        { x: 1104, y: 0, w: 180, h: 567 }
    ]
};

const empanadaXML = [
    { x: 0, y: 0, w: 560, h: 511 },
    { x: 560, y: 0, w: 560, h: 511 },
    { x: 560, y: 511, w: 560, h: 511 },
    { x: 0, y: 511, w: 560, h: 511 }
];

// Jugador
const player = {
    x: 100,
    y: 300,
    width: 45,
    height: 75,
    speed: 5.5,
    velX: 0,
    velY: 0,
    jumping: false,
    grounded: false,
    direction: 'right', 
    animFrame: 0,
    animTimer: 0
};

// Enemigos (Evil Empanadas)
let enemies = [
    { x: 400, y: 365, width: 55, height: 50, startX: 280, endX: 470, speed: 2, animFrame: 0 },
    { x: 650, y: 390, width: 55, height: 50, startX: 520, endX: 780, speed: 1.5, animFrame: 0 }
];

const gravity = 0.45;
const friction = 0.82;
const keys = {};

const platforms = [
    { x: 0, y: 440, width: 854, height: 40 }, 
    { x: 260, y: 315, width: 220, height: 20 },
    { x: 520, y: 210, width: 200, height: 20 }
];

function startGame() {
    startScreen.style.display = 'none';
    canvas.style.display = 'block';
    
    if (isMobile) {
        mobileControls.style.display = 'block';
        setupMobileControls();
    }

    // Registro unificado de mandos de PC
    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);
    
    gameLoop();
}

function setupMobileControls() {
    const bindTouch = (elementId, keyAction) => {
        const btn = document.getElementById(elementId);
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[keyAction] = true; });
        btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[keyAction] = false; });
    };
    bindTouch('btn-left', 'KeyA');
    bindTouch('btn-right', 'KeyD');
    bindTouch('btn-jump', 'Space');
}

function gameLoop() {
    // --- CONTROLES SIMULTÁNEOS (TECLADO + TÁCTIL) ---
    let moving = false;
    if (keys['ArrowRight'] || keys['KeyD']) {
        if (player.velX < player.speed) player.velX++;
        player.direction = 'right';
        moving = true;
    }
    if (keys['ArrowLeft'] || keys['KeyA']) {
        if (player.velX > -player.speed) player.velX--;
        player.direction = 'left';
        moving = true;
    }
    if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && !player.jumping && player.grounded) {
        player.jumping = true;
        player.grounded = false;
        player.velY = -player.speed * 2.2;
    }

    // Físicas básicas
    player.velX *= friction;
    player.velY += gravity;
    player.grounded = false;

    // --- COLISIÓN DE PLATAFORMAS ---
    for (let i = 0; i < platforms.length; i++) {
        let plat = platforms[i];
        if (player.x < plat.x + plat.width &&
            player.x + player.width > plat.x &&
            player.y + player.height <= plat.y &&
            player.y + player.height + player.velY >= plat.y) {
            
            player.grounded = true;
            player.jumping = false;
            player.velY = 0;
            player.y = plat.y - player.height;
        }
    }

    player.x += player.velX;
    player.y += player.velY;

    // Límites laterales de la pantalla
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;

    // --- MECÁNICA DE ATAQUE ESTILO MARIO (COLISIÓN ENEMIGOS) ---
    for (let i = enemies.length - 1; i >= 0; i--) {
        let en = enemies[i];

        // Patrullaje automático del enemigo
        en.x += en.speed;
        if (en.x < en.startX || en.x > en.endX) {
            en.speed = -en.speed; // Se da la vuelta
        }

        // Detección de colisión caja contra caja
        if (player.x < en.x + en.width &&
            player.x + player.width > en.x &&
            player.y < en.y + en.height &&
            player.y + player.height > en.y) {
            
            // ¿Viene cayendo desde arriba? (Ataque estilo Mario)
            if (player.velY > 0 && player.y + player.height - player.velY <= en.y + 15) {
                player.velY = -8; // Impulso hacia arriba
                player.jumping = true;
                enemies.splice(i, 1); // El enemigo muere y se borra
            } else {
                // Daño: Te tocó por el lado, reinicias nivel
                player.x = 100;
                player.y = 300;
                player.velX = 0;
                player.velY = 0;
            }
        }
    }

    // --- RENDERIZADO EN CANVAS ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Fondo / Tienda decorativa
    if (sprites.shop.complete) {
        ctx.drawImage(sprites.shop, 710, 340, 100, 100);
    }

    // Dibujar plataformas
    ctx.fillStyle = '#4a2c11';
    platforms.forEach(plat => ctx.fillRect(plat.x, plat.y, plat.width, plat.height));

    // Dibujar enemigos animados
    if (sprites.empanada.complete) {
        enemies.forEach(en => {
            en.animFrame = Math.floor(Date.now() / 120) % empanadaXML.length;
            let frame = empanadaXML[en.animFrame];
            ctx.drawImage(
                sprites.empanada,
                frame.x, frame.y, frame.w, frame.h,
                en.x, en.y, en.width, en.height
            );
        });
    }

    // --- ANIMACIÓN Y DIBUJO DE KING ORANGE ---
    let currentSprite = kingXML.idle;

    if (player.jumping) {
        currentSprite = kingXML.jump;
    } else if (moving && Math.abs(player.velX) > 0.5) {
        player.animTimer++;
        if (player.animTimer > 6) {
            player.animFrame = (player.animFrame + 1) % kingXML.walk.length;
            player.animTimer = 0;
        }
        currentSprite = kingXML.walk[player.animFrame];
    }

    if (sprites.king.complete) {
        ctx.save();
        // Voltear el sprite si camina hacia la izquierda
        if (player.direction === 'left') {
            ctx.translate(player.x + player.width, player.y);
            ctx.scale(-1, 1);
            ctx.drawImage(
                sprites.king,
                currentSprite.x, currentSprite.y, currentSprite.w, currentSprite.h,
                0, 0, player.width, player.height
            );
        } else {
            ctx.drawImage(
                sprites.king,
                currentSprite.x, currentSprite.y, currentSprite.w, currentSprite.h,
                player.x, player.y, player.width, player.height
            );
        }
        ctx.restore();
    }

    requestAnimationFrame(gameLoop);
}

