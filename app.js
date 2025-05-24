const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const sqlite3 = require('sqlite3').verbose();
const dbWrapper = require('sqlite');

const staticDir = path.join(__dirname, 'static');
const indexHtmlPath = path.join(staticDir, 'index.html');
const dbFile = './pizza.db';
let db;

async function initDatabase() {
    const exists = fs.existsSync(dbFile);
    db = await dbWrapper.open({ filename: dbFile, driver: sqlite3.Database });
    if (!exists) {
        await db.run(`CREATE TABLE pizza (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            ingredients TEXT,
            size TEXT
        );`);
        console.log('База даних та таблиця створені.');
    }
}

async function getPizzaTableRows() {
    const pizzas = await db.all('SELECT * FROM pizza');
    return pizzas.map(p => `
        <tr>
            <td>${p.name}</td>
            <td>${p.price}</td>
            <td>${p.ingredients}</td>
            <td>${p.size}</td>
            <td>
                <form action="/delete" method="POST" style="display:inline;">
                    <input type="hidden" name="id" value="${p.id}">
                    <button type="submit">Видалити</button>
                </form>
            </td>
        </tr>
    `).join('');
}

async function handleHomePage(res) {
    if (fs.existsSync(indexHtmlPath)) {
        const html = fs.readFileSync(indexHtmlPath, 'utf8');
        const tableRows = await getPizzaTableRows();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
        res.end(html.replace('{{tableRows}}', tableRows));
    } else {
        res.writeHead(500);
        res.end('Помилка: файл index.html не знайдено. Переконайтеся, що він є у папці static.');
    }
}

function parseRequestBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => { resolve(querystring.parse(body)); });
    });
}

async function handleAddPizza(req, res) {
    const data = await parseRequestBody(req);
    const { name, price, ingredients, size } = data;
    try {
        await db.run('INSERT INTO pizza (name, price, ingredients, size) VALUES (?, ?, ?, ?)',
            [name, price, ingredients, size]);
        res.writeHead(302, { Location: '/' });
        res.end();
    } catch (err) {
        res.writeHead(500);
        res.end('Помилка додавання даних');
    }
}

async function handleDeletePizza(req, res) {
    const data = await parseRequestBody(req);
    const { id } = data;
    try {
        await db.run('DELETE FROM pizza WHERE id = ?', [id]);
        res.writeHead(302, { Location: '/' });
        res.end();
    } catch (err) {
        res.writeHead(500);
        res.end('Помилка видалення');
    }
}

function serveStaticFile(req, res) {
    const filePath = path.join(staticDir, req.url);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const mimeTypes = {
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.ico': 'image/x-icon'
        };
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.writeHead(404);
        res.end('Не знайдено');
    }
}

async function main() {
    await initDatabase();
    const server = http.createServer(async (req, res) => {
        if (req.method === 'GET' && req.url === '/') {
            await handleHomePage(res);
        } else if (req.method === 'POST' && req.url === '/add') {
            await handleAddPizza(req, res);
        } else if (req.method === 'POST' && req.url === '/delete') {
            await handleDeletePizza(req, res);
        } else if (req.method === 'GET') {
            serveStaticFile(req, res);
        } else {
            res.writeHead(404);
            res.end('Не знайдено');
        }
    });

    server.listen(3000, () => {
        console.log('Сервер запущено на http://localhost:3000');
    });
}

main();
