//creatinh utility for async function with promises method

const asyncHandler  = (requestHandler)=>{
     return (req,res,next) => {
        Promise.resolve(requestHandler(req,res,next)).catch((err)=>next(err))
    }
}

export {asyncHandler}

// const asyncHandler = () => {}
// const asyncHandler = (fn) => () => {} 
// const asyncHandler = (fn) => {()=>{}} 
// const asyncHandler = (fn) => {async()=>{}} 
// const asyncHandler = (fn) => async() => {} 

//creatinf a utl for async function with try catch method

// const asyncHandler = (fn)=> async(req,res,next) => {
//    try{
//     await fn(req,res,next)
//    }catch(error){
//        res.status(error.code || 500).json({
//         success:false,
//         message : error.message
//        })
//    }
// }