// Обновлённый app.js с использованием sqlite (локальная база), без WebSockets
const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const sqlite3 = require('sqlite3').verbose();
const dbWrapper = require('sqlite');

const htmlFile = 'index.html';
const defaultHtmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>Pizza App</title>
    <style>
        body { font-family: sans-serif; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 10px; }
        input, select, button { margin: 5px 0; padding: 8px; }
    </style>
</head>
<body>
    <h1>Добавить пиццу</h1>
    <form action="/add" method="POST">
        <input type="text" name="name" placeholder="Название" required><br>
        <input type="number" name="price" placeholder="Цена" required><br>
        <input type="text" name="ingredients" placeholder="Ингредиенты" required><br>
        <select name="size">
            <option value="Маленькая">Маленькая</option>
            <option value="Средняя">Средняя</option>
            <option value="Большая">Большая</option>
        </select><br>
        <button type="submit">Добавить</button>
    </form>

    <h2>Список пицц</h2>
    <table>
        <tr><th>Название</th><th>Цена</th><th>Ингредиенты</th><th>Размер</th></tr>
        {{tableRows}}
    </table>
</body>
</html>`;

if (!fs.existsSync(htmlFile)) {
    fs.writeFileSync(htmlFile, defaultHtmlContent);
    console.log('index.html was missing and has been created.');
}

const dbFile = './pizza.db';
const exists = fs.existsSync(dbFile);
let db;

(async () => {
    db = await dbWrapper.open({
        filename: dbFile,
        driver: sqlite3.Database
    });

    if (!exists) {
        await db.run(`CREATE TABLE pizza (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            price REAL,
            ingredients TEXT,
            size TEXT
        );`);
        console.log('Database and table created.');
    }
})();

const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        try {
            const pizzas = await db.all('SELECT * FROM pizza');
            let tableRows = pizzas.map(p => `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.price}</td>
                    <td>${p.ingredients}</td>
                    <td>${p.size}</td>
                </tr>
            `).join('');

            const html = fs.readFileSync(htmlFile);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html.toString().replace('{{tableRows}}', tableRows));
        } catch (err) {
            res.writeHead(500);
            res.end('Ошибка базы данных');
        }
    } else if (req.method === 'POST' && req.url === '/add') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            const data = querystring.parse(body);
            const { name, price, ingredients, size } = data;

            try {
                await db.run('INSERT INTO pizza (name, price, ingredients, size) VALUES (?, ?, ?, ?)',
                    [name, price, ingredients, size]);
                res.writeHead(302, { Location: '/' });
                res.end();
            } catch (err) {
                res.writeHead(500);
                res.end('Ошибка добавления данных');
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
