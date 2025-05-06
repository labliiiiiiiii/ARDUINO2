const http = require('http');
const fs = require('fs');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { Server } = require('socket.io');

// Serve HTML page and handle static files
const server = http.createServer((req, res) => {
    // Serve index.html for the root path
    if (req.url === '/' || req.url === '/index.html') {
        const htmlPath = path.join(__dirname, 'index.html');
        fs.readFile(htmlPath, (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } 
    // Handle socket.io resources and other static files
    else {
        res.writeHead(404);
        res.end();
    }
});

// Configure Socket.io with CORS enabled
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

let globalTemperature = 0;
let globalHumidity = 0;

const arduinoDevices = [
    { port: "COM6", isTempHumiditySource: true },
];

arduinoDevices.forEach(device => {
    try {
        const serialPort = new SerialPort({ path: device.port, baudRate: 9600 });
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

        console.log(`✅ Connected to Arduino at ${device.port}`);

        parser.on('data', data => {
            try {
                data = data.trim();

                if (data.startsWith("{") && data.endsWith("}")) {
                    const jsonData = JSON.parse(data);

                    if (device.isTempHumiditySource) {
                        globalTemperature = jsonData.temperature || globalTemperature;
                        globalHumidity = jsonData.humidity || globalHumidity;
                    } 

                    console.log(`🌡️ Temperature: ${jsonData.temperature}°C`);
                    console.log(`💧 Humidity: ${jsonData.humidity}%`);
                    console.log(`🔌 Turbidity Voltage: ${jsonData.turbidityVoltage} V`);
                    console.log(`🧪 Turbidity NTU: ${jsonData.turbidityNTU}`);

                   let status = "Safe";
                    if (jsonData.turbidityNTU > 0 && jsonData.turbidityNTU <= 1) {
                        status = "Drinkable";
                    } else if (jsonData.turbidityNTU > 1 && jsonData.turbidityNTU <= 5) {
                        status = "Clear";
                    } else if (jsonData.turbidityNTU > 5 && jsonData.turbidityNTU <= 10) {
                        status = "Slightly Cloudy";
                    } else if (jsonData.turbidityNTU > 10 && jsonData.turbidityNTU <= 20) {
                        status = "Cloudy";
                    } else if (jsonData.turbidityNTU > 20 && jsonData.turbidityNTU <= 30) {
                        status = "Very Cloudy";
                    } else if (jsonData.turbidityNTU > 30) {
                        status = "Highly Polluted";
                    } else {
                        status = "Sensor is not submerged in water";
                    }

                    jsonData.status = status;
                    console.log(`🚦 Status: ${status}`);
                    console.log("---------------------------");

                    io.emit("sensorData", jsonData);
                } else {
                    console.log(`⚠️ Non-JSON Data from ${device.port}:`, data);
                }
            } catch (error) {
                console.error(`❌ JSON Parse Error from ${device.port}:`, error.message);
            }
        });

        serialPort.on('error', err => {
            console.error(`❌ Serial Port Error on ${device.port}:`, err.message);
        });

    } catch (err) {
        console.error(`❌ Failed to connect to ${device.port}:`, err.message);
    }
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log("🟢 Socket.io client connected");
});

server.listen(3000, () => {
    console.log("🌐 Server running at http://localhost:3000/");
});