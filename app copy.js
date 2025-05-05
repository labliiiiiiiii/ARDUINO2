var http = require('http');
var fs = require('fs');

var index = fs.readFileSync('index.html', 'utf8');

var serialport = require('serialport');

const parsers = serialport.parsers;
const parser = new parsers.Readline({ delimiter: '\r\n' });

var port = new serialport('/dev/ttyUSB0', 
    { 
        baudRate: 9600, 
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: false,
    });

port.pipe(parser);

var app = http.createServer(function (req, res) { 
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(index);
});

var io = require('socket.io').listen(app);

io.on('connection', function (socket) {
    console.log('nakikinig');
});

parser.on('data', function(data) {
    console.log('Data received: ' + data);

    io.emit('data', data); // Emit the data to all connected clients
});

app.listen(3000);

let globalTemperature = 0;
let globalHumidity = 0;

const arduinoDevices = [
    { port: "COM6", isTempHumiditySource: true },
];

arduinoDevices.forEach(device => {
    try {
        const serialPort = new SerialPort({ path: device.port, baudRate: 9600 });
        const parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

        console.log(`✅ Connected to Arduino at ${device.port} for ${device.barangay}`);

        parser.on("data", (data) => {
            try {
                data = data.trim();
                if (data.startsWith("{") && data.endsWith("}")) {
                    const jsonData = JSON.parse(data);
                    jsonData.barangay = device.barangay;

                    if (device.isTempHumiditySource) {
                        globalTemperature = jsonData.temperature || globalTemperature;
                        globalHumidity = jsonData.humidity || globalHumidity;
                    } else {
                        jsonData.temperature = globalTemperature;
                        jsonData.humidity = globalHumidity;
                    }

                    // Display formatted data
                    console.log(`🌡️ Temperature: ${jsonData.temperature}°C`);
                    console.log(`💧 Humidity: ${jsonData.humidity}%`);
                    console.log(`🌊 Water Level: ${jsonData.waterLevel} cm`);

                    // Evaluate water level status
                    let status = "Safe";
                    if (jsonData.waterLevel >= 30) status = "Danger";
                    else if (jsonData.waterLevel >= 15) status = "Warning";

                    console.log(`🚦 Status: ${status}`);
                    console.log("---------------------------");

                } else {
                    console.log(`⚠️ Non-JSON Data from ${device.port}:`, data);
                }
            } catch (error) {
                console.error(`❌ JSON Parse Error from ${device.port}:`, error.message);
            }
        });

        serialPort.on('error', (err) => {
            console.error(`❌ Serial Port Error on ${device.port}:`, err.message);
        });

    } catch (error) {
        console.error(`❌ Failed to initialize Arduino at ${device.port}:`, error.message);
    }
});