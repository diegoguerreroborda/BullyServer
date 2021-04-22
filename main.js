const express = require('express');
const axios = require('axios');
//const cors = require('cors');
const shell = require('shelljs');
var  cron  = require('node-cron');
const bodyParser = require('body-parser');

const port = 3000;

const app = express()
app.use(bodyParser.json())
//app.use(cors())

const id = port;
//let servers = [{path: "http://localhost:3000/", alive: false, id:3000, isLeader: true}];
//let servers = [{path: "http://localhost:3000/", alive: true, id: 3000, isLeader:true}, {path: "http://localhost:2999/", alive: true, id: 2999, isLeader:false}, {path: "http://localhost:2998/", alive: true, id: 2998, isLeader:false}];
let servers = []
let isLeader = true;
let leaderHost = '';
let serversHiguer = [];

//Envia latidos al lider cada 15 segundos
//Los latidos se deben hacer en un tiempo aleatorio.
var taskheartbeat = cron.schedule('*/25 * * * * *', async () => {
    console.log('Cada cierto tiempo hacerle ping al lider')
    console.log(servers)
    if(!isLeader){
        await axios.get(leaderHost)
        .then(function (response) {
            //Hace una petición GET al servidor
            console.log(response.data)
        }).catch(async function (error) {
            //Parar todos los latidos
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
        leaderHost = `http://localhost:${port}/`
        isLeader = true;
        await findHost(`http://localhost:${port}/`)
        //Hacer un for que busque eso
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
            console.log('no se si entra')
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

//Implementado por el que inicia la busqueda
async function sendLeader(afterUrl){
    console.log("Enviando lider a todos...")
    for (const host in servers) {
        console.log(servers[host].path)
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
    for (const serverHigh in servers) {
        if(servers[serverHigh].id == numberHigh){
            console.log(servers[serverHigh].path)
            leaderHost = servers[serverHigh].path
            servers[serverHigh].isLeader = true;
            await axios.get(`${servers[serverHigh].path}leader`)
            .then(function (response) {
                console.log(response.data)
            }).catch(function (error) {
                console.log('Error ni el hp')
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
//servers.push({path:req.body.server, alive : true, id:portInstance})

app.get('/leader', (req, res) => {
    isLeader = true;
    res.sendStatus(200)
})

//Para los latidos al lider
app.get('/heartbeat_stop', (req, res) => {
    taskheartbeat.stop();
    res.sendStatus(200)
})

//Inicia los latidos al lider
app.get('/heartbeat_start', (req, res) => {
    taskheartbeat.start();
    res.sendStatus(200)
})

app.post('/new_server', (req, res) => {
    console.log('El nuevo server es:', req.body.servers)
    if(servers.length == 0){
        console.log('Crear el lider')
        isLeader = true
        //currentServer = {path:`http://localhost:${portInstance}/`, alive : true, id:portInstance, isLeader:true}
        leaderHost = req.body.path
        servers.push({path: req.body.path, alive: true, id: req.body.id, isLeader: true})
        //servers = req.body.servers
    }else{
        console.log('Ya hay un lider')
        isLeader = false
        servers = req.body.servers
        //servers.push({path: req.body.path, alive: true, id: req.body.id, isLeader: false})
        //servers.push({path:req.data.server, alive : true, id:portInstance})
        //currentServer = {path:`http://localhost:${portInstance}/`, alive : true, id:portInstance, isLeader:false}
    }
    //servers.push(req.body.server)
    //servers = req.data.servers
    res.sendStatus(200)
})

app.get('/list_servers', (req, res) => {
    console.log('Lista de servidores', servers)
    res.send(servers)
})

app.get('/leader_called', (req, res) => {
    res.send(leaderHost)
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})