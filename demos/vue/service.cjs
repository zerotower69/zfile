const express = require('express')
const cors = require('cors')

const app = express();

app.use(cors())

app.get('/',function (req,res){
    setTimeout(()=>{
        res.json({
            method:'get',
            message:'hello'
        })
    },1000)
})

app.post('/',function (_,res){
    setTimeout(()=>{
        res.json({
            method:'post',
            message:'aa'
        })
    },1000)
})

app.listen(3000)