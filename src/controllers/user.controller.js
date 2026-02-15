import {asyncHandler} from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import { uploadOnCloudinary } from '../utils/cloudinary.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessAndRefreshTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})  //we saved teh refreshtoken in the user database
   
        return {accessToken,refreshToken}
    }catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }                                                  
}        

const registerUser = asyncHandler(async(req , res)=>{
    //get user details from frontend
    //validation : not empty
    //check if user already exist : username, email
    //check for images , check for avatar
    //upload them to cloudinary , avatar
    //create user object -- create entry in database
    //remove password and refresh token field from response
    //check for user creation 
    //return res

    const {fullName , username , email , password} = req.body;
    if([fullName,email,username,password].some((field)=> field?.trim()==="")){
        throw new ApiError(400,"All fields are required")
    }
    if(!email.includes("@gmail.com")){
        throw new ApiError(400,"type a proper email")
    }

    const existedUser = await User.findOne({
        $or:[{ username },{ email }]
    })
    if (existedUser) {
    if (existedUser.username === username) {
        throw new ApiError(409, "Username already exists");
    }
    if (existedUser.email === email) {
        throw new ApiError(409, "Email already exists");
    }
}
    
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }


    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    const user = await User.create({ //User.create() is a Mongoose model method used to create and save a new document in MongoDB. It validates schema rules, executes middleware like password hashing, inserts the document into the database, and returns the created document.
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    // console.log(user) by this we can see how our data looks in data base 

    const createdUser =  await User.findById(user._id).select(
        "-password -refreshToken"
    )
    
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered Successfully")
    )

})

const loginUser = asyncHandler(async(req,res)=>{
    //req body -> data
    // login by username or email
    // find the user (this his username or email exists or not to login)
    // password check
    // access and refresh token
    // send cookie 

    const {email,username,password} = req.body
    
    if(!username && !email){
        throw new ApiError(400,"Username or email is required")
    }
    
    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }
     
    const isPasswordValid = await user.isPasswordCorrect(password)
    
    if(!isPasswordValid){
        throw new ApiError(401,"Password Incorrect")
    }
    
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    
    const loggedInUser = await User.findById(user._id)
    .select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken , options)
    .cookie("refreshToken",refreshToken ,options)
    .json(
        new ApiResponse(
            200, //status code
            { //data 
                user : loggedInUser,accessToken,refreshToken
            },
            "User logged In Successfully" //message 
        )
    )
})

const logoutUser= asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new: true // it is used to update changes in the mongodb
        }
    )
    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged Out"))
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
   if(!incomingRefreshToken){
    throw new ApiError(401,"Unauthorised request")
   }
   try {
    const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET) //it will return the payload data of the refreshToken that is ._id
    
    const user = await User.findById(decodedToken?._id)
    if(!user){
     throw new ApiError(401,"Invalid refresh Token")
    }
 
    if(incomingRefreshToken !== user?.refreshToken){
     throw new ApiError(401, "Refresh token is expired or used")
    }
 
    const options = {
     httpOnly :  true,
     secure:true
    }
    
    const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
 
    return res
    .status(200)
    .cookie("accessToken", accessToken ,options)
    .cookie("refreshToken", newRefreshToken,options)
    .json(
         new ApiResponse(
             200,
             {accessToken,refreshToken : newRefreshToken}
         )
    )
    }catch (error){
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    const user= await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400, "Invalid old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfuly"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"current user fetched successfuly"))

})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body

    if(!fullName || !email){
        throw new ApiError(600,"All field are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName: fullName,
                email : email
            }
        },
        {new :  true} //it returns the updated information 
    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfulyd4hatgi"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar :avatar.url
            }
        },
        {new: true}
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Avatar image updated successfully")
    )

})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage :coverImage.url
            }
        },
        {new: true}
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover image updated successfully")
    )

})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
   const {username} = req.params // https:localhost:8000/api/v1/piyushkohli

   if(!username?.trim()){
    throw new ApiError(400,"username is missing")
   }

   const channel = await User.aggregate([
    {
        $match:{ // it is used tp specify that where the all of the operations are gonne be performes and that is username from where we will move up to the next stage
            username:username?.toLowerCase()
        }
    },
    {
        $lookup:{ //it is used to combine two data of different schema like user and subscriber
            from : "subscription", //subscription schema is being joined with the user
            localField:"_id", // it is the user._id which is going to be connect with the subscription schema fields
            foreignField:"channel", // it is the channel field which will connect with the user._id
            as:"subscribers" //and this connection will be calles as subcriber
            /*
            user 1 : channel 1,
            user2 : channel 1,
            user3 : channel 1,

            therefore number of subscriber for channel 1 are three
            */
        }
    },
    {
        $lookup:{
            from : "subscription",
            localField:"_id",
            foreignField:"subscriber", // not the subscriber field is getting connected with user._id
            as:"subscribedTo"
        }
        /*
          user 1: channel 1
          user 1 : channel 2
          user 1 : channel 4

          so the user 1 has subscribed to channel 1,2 and 4
        */
    },
    {
        $addFields:{ //it is addinf functions like counting 
            subscribersCount:{
                $size:"$subscribers" //it tell number of counts of subscriber
            },
            channelSubscribedToCount:{
                $size:"$subscribedTo" // it tells number of counts of suncribedTo
            },
            isSubscribed:{ // it checks the user is the subscriber is in the subscriberlist or not
                $cond:{
                    if:{$in:[req.user?._id,"$subscribers.subscriber"]}, 
                    then:true,
                    else:false
                }
            }
        }
    },
    {
        $projects:{  // it projects the fields which are goinf to be displayed on the username url
            fullName:1,
            username:1,
            subscriberCount : 1,
            channelSubscribedToCount:1,
            isSubscribed:1,
            avatar:1,
            coverImage:1,
            email:1
        }
    }
   ])

   if(!channel?.length){
    throw new ApiError(404,"channel does not exist")
   }

   return res
   .status(200)
   .json(
    new ApiResponse(200,channel[0],"User channel fetched successfully")
   )
})


export {registerUser , loginUser , logoutUser, refreshAccessToken , changeCurrentPassword , getCurrentUser, updateAccountDetails , updateUserAvatar ,updateUserCoverImage ,getUserChannelProfile}
