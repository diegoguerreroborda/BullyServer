const express = require('express');
const axios = require('axios');
//const cors = require('cors');
const shell = require('shelljs');
var  cron  = require('node-cron');
const bodyParser = require('body-parser');
//const { response } = require('express');

const port = process.argv[2];

const app = express()
app.use(bodyParser.json())
//app.use(cors())

const id = port;
let servers = [{path: "http://localhost:3002/", alive: false, id:3002}, {path: "http://localhost:3001/", alive: false, id: 3001}, {path: "http://localhost:3000/", alive: false, id: 3000}];
//let servers = []
let isLeader = false;
let leaderHost = 'http://localhost:3002/';
let serversHiguer = [];

//Envia latidos al lider cada 15 segundos
//Los latidos se deben hacer en un tiempo aleatorio.
var taskheartbeat = cron.schedule('*/25 * * * * *', async () => {
    console.log('Cada cierto tiempo hacerle ping al lider')
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
function chooseHiguer(){
    console.log('Escoger al mayor')
    let numberHigh = 0;
    if(serversHiguer.length == 0){
        console.log('El es el server mayor')
        leaderHost = `http://localhost:${port}`
        isLeader = true;
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
            //console.log(response.data)
            //servers[server].alive = true;
            //Aqui busca solo los Enviar peticiones a todos
        } catch(err) {
            console.log('err.Error')
            //servers[server].alive = false;
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
              leader: leaderHost
            }
        }).then(response => {
            console.log('Resultado:', response.data);
            taskheartbeat.start()
            getRequest('heartbeat_start')
        }).catch(err => {
            console.log("Apagadooo")
            //servers[host].alive = false;
        });
    }
}

//Implementado por el que inicia la busqueda
async function sendHeartBeatToLeader(numberHigh){
    console.log('Escoger al server mayor')
    for (const serverHigh in serversHiguer) {
        if(serversHiguer[serverHigh].id == numberHigh){
            console.log(serversHiguer[serverHigh].path)
            leaderHost = serversHiguer[serverHigh].path
            await axios.get(`${serversHiguer[serverHigh].path}leader`)
            //Comenzar otra vez con los latidos
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
    console.log('leader is: ', leaderHost)
    res.sendStatus(200)
})

app.get('/', (req, res) => {
    res.sendStatus(200)
})

app.get('/id_server', (req, res) => {
    res.json(id)
})

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

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})