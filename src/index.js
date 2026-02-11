import dotenv from 'dotenv'
import connectDB from './db/index.js'
import { app } from './app.js'


dotenv.config({
    path:'./env'
})

connectDB()
.then(()=>{
    app.listen(process.env.PORT || 8000 ,()=>{
        console.log(`Server is running on port ${process.env.PORT}`)
    })
    app.on("error",(error)=>{
        console.log("ERRR:",error);
        throw error
    })
})
.catch((err)=>{
    console.log("MONGODB connection failed !!!",err)
})














// THIS IS HOW DATABASE IS CONNECTED INSIDE THE INDEX.JS FILE 
/*
import express from 'express';
const app = express()
;(async ()=>{
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}`)
        app.on("error",(error)=>{
            console.log("ERRR:",error);
            throw error
        }) // this is used to handle error because of the express even if the database is connected properly
        app.listen(process.env.PORT,()=>{
            console.log(`App is listening on port ${process.env.PORT}`)
        })
    }catch(error){
        console.log("ERROR : ",error)
        throw error
    }
})()
*/