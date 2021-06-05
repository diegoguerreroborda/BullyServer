const express = require('express');
const axios = require('axios');
const shell = require('shelljs');
var  cron  = require('node-cron');
const bodyParser = require('body-parser');

//const PORT = process.argv[2];
const PORT = 3000;

const app = express()
app.use(bodyParser.json())

let id = PORT;
let servers = []
//let servers = [{path: "http://localhost:3000/", alive: true, id: 3000, isLeader:true}, {path: "http://localhost:2999/", alive: true, id: 2999, isLeader:false}, {path: "http://localhost:2998/", alive: true, id: 2998, isLeader:false}];
let isLeader = true;
let leaderHost = 'http://172.17.0.1:4000/';
let serversHiguer = [];

let monitoring = [];
let countM = 0;
let timeBeat = getRandomArbitrary(4,9);

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
  }

//Los latidos se deben hacer en un tiempo aleatorio.
var taskheartbeat = cron.schedule(`*/${timeBeat} * * * * *`, async () => {
    console.log('Cada cierto tiempo hacerle ping al lider')
    console.log(servers)
    if(!isLeader){
        await axios.get(leaderHost)
        .then(function (response) {
            //Hace una petición GET al servidor
            console.log(response.data)
        }).catch(async function (error) {
            //Parar todos los latidos
            monitoring.push({time:Date.now, action:'Parar latidos', server:id})
            taskheartbeat.stop();
            await getRequest('heartbeat_stop')
            await getIds();
        });
    }
});

//Implementado por el que inicia la busqueda
async function getIds(){
    console.log("Lider caido, escogiendo nuevo lider...")
    serversHiguer = [];
    console.log("Recoger Id's...")
    await getRequest('id_server')
    chooseHiguer();
}

//Implementado por el que inicia la busqueda
async function chooseHiguer(){
    console.log('Escoger al mayor')
    let numberHigh = 0;
    if(serversHiguer.length == 0){
        console.log('El es el server mayor')
        leaderHost = `http://172.17.0.1:${id}/`
        isLeader = true;
        await findHost(`http://172.17.0.1:${id}/`)
        sendLeader('new_leader')
    }else{
        for (const serverHigh in serversHiguer) {
            if(serversHiguer[serverHigh].id > numberHigh){
                numberHigh = serversHiguer[serverHigh].id
            }
        }
        sendHeartBeatToLeader(numberHigh)
    }
}

function findHost(host) {
    console.log('Aquiii')
    for (const server in servers) {
        if(servers[server].path == host){
            servers[server].isLeader = true;
        }
    }
}

//Implementado por el que inicia la busqueda
async function getRequest(urlFinal){
    console.log('Recibiendo respuestas de todos')
    for (const server in servers) {
        try {
            console.log(`${servers[server].path}${urlFinal}`)
            response = await axios(`${servers[server].path}${urlFinal}`)
            console.log(response.data)
            if(urlFinal ==='id_server'){
                if(response.data > id){
                    serversHiguer.push({path: servers[server].path, id: servers[server].id})
                }
            }
            servers[server].alive = true;
        } catch(err) {
            console.log('err.Error')
            servers[server].alive = false;
            servers[server].isLeader = false;
        }
    }
}

async function sendToCoordinator() {
    await axios({
        method: 'post',
        url : `http://172.17.0.1:3050/update`,
        data: {
          servers: servers,
          leader: leaderHost
        }
    }).then(response => {
        console.log('Resultado:', response.data)
    }).catch(err => {
        console.log("No existe")
    });
}

//Implementado por el que inicia la busqueda
async function sendLeader(afterUrl){
    console.log("Enviando lider a todos...")
    for (const host in servers) {
        console.log(servers[host].path)
        monitoring.push({time:Date.now, action:`Lider: ${leaderHost}`, server:id})
        await axios({
            method: 'post',
            url : `${servers[host].path}${afterUrl}`,
            data: {
              leader: leaderHost,
              servers: servers
            }
        }).then(response => {
            console.log('Resultado:', response.data);
            taskheartbeat.start()
            getRequest('heartbeat_start')
        }).catch(err => {
            console.log("Apagadooo")
        });
    }
}

//Implementado por el que inicia la busqueda
async function sendHeartBeatToLeader(numberHigh){
    console.log('Escoger al server mayor')
    for (const server in servers) {
        if(servers[server].id == numberHigh){
            console.log(servers[server].path)
            leaderHost = servers[server].path
            servers[server].isLeader = true;
            console.log('Serverhigh', server)
            //Hacer un post enviandole
            await axios({
                method: 'post',
                url : `${servers[server].path}leader`,
                data: {
                  high: server
                }
            }).then(response => {
                console.log('Resultado:', response.data);
                taskheartbeat.start()
            }).catch(err => {
                console.log("Error")
            });
        }
    }
    //Otra vez envia el mensaje a todos con el nuevo lider.
    console.log('Enviando server mayor a todos...')
    sendLeader('new_leader')
}

app.post('/new_leader', (req, res) => {
    leaderHost = req.body.leader;
    servers = req.body.servers;
    console.log('leader is: ', leaderHost)
    res.send(leaderHost)
})

app.get('/', (req, res) => {
    res.sendStatus(200)
})

app.get('/id_server', (req, res) => {
    res.json(id)
})

app.post('/leader', async (req, res) => {
    servers[req.body.high].isLeader = true;
    isLeader = true;
    await sendToCoordinator()
    res.sendStatus(200)
})

//Para los latidos al lider
app.get('/heartbeat_stop', (req, res) => {
    taskheartbeat.stop();
    res.sendStatus(200)
})

//Inicia los latidos al lider
app.get('/heartbeat_start', (req, res) => {
    monitoring.push({time:Date.now, action:`Activando latidos`, server:id})
    taskheartbeat.start();
    res.sendStatus(200)
})

app.post('/new_server', (req, res) => {
    
    console.log('El nuevo server es:', req.body.servers)
    servers = req.body.servers
    id = req.body.id
    monitoring.push({time:Date.now, action:`Nuevo servidor creado`, server:id})
    if(servers.length == 1){
        console.log('Crear el lider')
        isLeader = true
        leaderHost = req.body.path
    }else{
        console.log('Ya hay un lider')
        isLeader = false
        leaderHost = req.body.leader
    }
    res.send(servers)
})

app.post('/update', (req, res) => {
    servers = req.body.servers
    res.sendStatus(200)
})

app.get('/update', (req, res) => {
    res.send(servers)
})

app.get('/list_servers', (req, res) => {
    console.log('Lista de servidores', servers)
    res.send(servers)
})

app.get('/leader_called', (req, res) => {
    res.send(leaderHost)
})

app.get('/monitoring', (req, res) => {
    res.send(monitoring)
})

app.listen(PORT, () => {
    console.log(`Example app listening at http://172.17.0.1:${PORT}`)
})