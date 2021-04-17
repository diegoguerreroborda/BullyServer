const express = require('express');
const axios = require('axios');
//const cors = require('cors');
const shell = require('shelljs');
var  cron  = require('node-cron');
const { response } = require('express');

const port = process.argv[2];

const app = express()
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
            console.log("Escoger nuevo lider")
            sendRequestToAll();
        });
    }
});

async function sendRequestToAll(){
    console.log('Enviar peticiones a todos')
    serversHiguer = [];
    for (const server in servers) {
        try {
            response = await axios(`${servers[server].path}/id_server`)
            console.log(response)
            console.log('data', response.data)
            servers[server].alive = true;
            //Aqui busca solo los mayores que él.
            if(response > id){
                serversHiguer.push({path: servers[server].path, id : response});
            }
        } catch(err) {
            //servers[server].alive = false;
        }
    }
    chooseHiguer();
    //res.send(textServers);
}

function chooseHiguer(){
    console.log('Escoger al mayor')
    let numberHigh = 0;
    if(serversHiguer.length == 0){
        console.log('El es el server mayor')
    }else{
        for (const serverHigh in serversHiguer) {
            if(serversHiguer[serverHigh].id > numberHigh){
                numberHigh = servers[server].id
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
            .then(function (response) {
                console.log(response.data)
            }).catch(function (error) {
                console.log('Error ni el hp')
            });
        }
    }
}

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