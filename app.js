const http = require('https');
const fs = require('fs');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const socketio = require('socket.io');

// Serve HTML page
const index = fs.readFileSync('index.html', 'utf8');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(index);
});

const io = socketio(server);
const socket = io();  // Will connect to same origin

let globalTemperature = 0;
let globalHumidity = 0;

const arduinoDevices = [
    { port: "COM6", isTempHumiditySource: true },  // Change to "/dev/ttyUSB0" if on Linux
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
                    } else {
                        jsonData.temperature = globalTemperature;
                        jsonData.humidity = globalHumidity;
                    }

                    // Set the remark element
                    const remark = document.getElementById("waterQualityRemark");
                    if (remark) remark.innerText = status;

                    // Optionally update a general status label too
                    const statusElement = document.getElementById("status");
                    if (statusElement) statusElement.innerText = status;

                    // jsonData.status = status;
                    // console.log(`🚦 Status: ${status}`);
                    // console.log("---------------------------");

                    // io.emit("sensorData", jsonData);
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

// Listen for socket connections
io.on('connection', (socket) => {
    console.log("🟢 Socket.io client connected");

    // Emit a test data to client for debugging
    socket.emit('sensorData', {
        temperature: globalTemperature,
        humidity: globalHumidity,
        waterLevel: 20,  // Example value for testing
    });
});

server.listen(3000, () => {
    console.log("🌐 Server running at https://localhost:3000/");
});