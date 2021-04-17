const express = require('express');
const axios = require('axios');
//const cors = require('cors');
const shell = require('shelljs');
var  cron  = require('node-cron');

const port = 3000;

const app = express()
//app.use(cors())

const id = port;
let servers = [{path: "http://localhost:3000/", alive: false}, {path: "http://localhost:3001/", alive: false}];
//let servers = []
let isLeader = true;
let leaderHost = 'http://localhost:3000/';
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

function sendRequestToAll(){
    serversHiguer = [];
    for (const server in servers) {
        try {
            response = await axios(`${servers[server].path}/id_server`)
            servers[server].alive = true;
            //Aqui busca solo los mayores que él.
            if(response > id){
                serversHiguer.push({path: servers[server].path, id = response});
            }
        } catch(err) {
            //servers[server].alive = false;
        }
    }
    chooseHiguer();
    res.send(textServers);
}

function chooseHiguer(){
    let numberHigh = 0;
    for (const serverHigh in serversHiguer) {
        if(serversHiguer[serverHigh].id > numberHigh){
            numberHigh = servers[server].id
        }
    }
    sendHeartBeatToLeader(numberHigh)
}

function sendHeartBeatToLeader(numberHigh){
    for (const serverHigh in serversHiguer) {
        if(serversHiguer[serverHigh].id == numberHigh){
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