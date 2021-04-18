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
let servers = [{path: "http://localhost:3002/", alive: false}, {path: "http://localhost:3001/", alive: false}, {path: "http://localhost:3000/", alive: false}];
//let servers = []
let isLeader = false;
let leaderHost = 'http://localhost:3002/';
let serversHiguer = [];

//Envia latidos al lider cada 15 segundos
//Los latidos se deben hacer en un timepo aleatorio.
var taskheartbeat = cron.schedule('*/25 * * * * *', () => {
    console.log('Cada cierto tiempo hacerle ping al lider')
    if(!isLeader){
        axios.get(leaderHost)
        .then(function (response) {
            //Hace una petición GET al servidor
            console.log(response.data)
        }).catch(function (error) {
            //Parar todos los latidos
            console.log("Escoger nuevo lider")
            getIds();
        });
    }
});

async function getIds(){
    serversHiguer = [];
    await getRequest('id_server')
    chooseHiguer();
}

async function getRequest(urlFinal){
    console.log('Enviar peticiones a todos')
    //serversHiguer = [];
    for (const server in servers) {
        try {
            console.log(`${servers[server].path}urlFinal`)
            response = await axios(`${servers[server].path}${urlFinal}`)
            console.log(response.data)
            //servers[server].alive = true;
            //Aqui busca solo los mayores que él.
            if(response.data > id){
                serversHiguer.push({path: servers[server].path, id : response.data});
            }
        } catch(err) {
            console.log(err.Error)
            //servers[server].alive = false;
        }
    }
}

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
        }).catch(err => {
            console.log("Apagadooo")
            //servers[host].alive = false;
        });
    }
}

function chooseHiguer(){
    console.log('Escoger al mayor')
    let numberHigh = 0;
    if(serversHiguer.length == 0){
        console.log('El es el server mayor')
    }else{
        for (const serverHigh in serversHiguer) {
            if(serversHiguer[serverHigh].id > numberHigh){
                numberHigh = serversHiguer[serverHigh].id
            }
        }
        sendHeartBeatToLeader(numberHigh)
    }
}

async function sendHeartBeatToLeader(numberHigh){
    console.log('Escoger al server mayor')
    for (const serverHigh in serversHiguer) {
        if(serversHiguer[serverHigh].id == numberHigh){
            console.log(serversHiguer[serverHigh].path)
            axios.get(serversHiguer[serverHigh].path)
            //Le dice que el va a ser el nuevo lider.
            //Comenzar otra vez con los latidos
            .then(function (response) {
                console.log(response.data)
            }).catch(function (error) {
                console.log('Error ni el hp')
            });
        }
    }
    //Otra vez envia el mensaje a todos con el nuevo lider.
    sendLeader('new_leader')
}

app.post('/new_leader', (req, res) => {
    leaderHost = req.body.leader;
    console.log(leaderHost)
    res.sendStatus(200)
})

app.get('/', (req, res) => {
    res.sendStatus(200)
})

app.get('/id_server', (req, res) => {
    res.json(id)
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