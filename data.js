import { DATABASE_NAME, DATABASE_RECORD_STORE_NAME } from "../variables.js"

let database

//create database, eventually recovering from disk
export const restoreDataFromDisk=async(filename,cleanBefore=false)=>{
  let data
  if(filename) data=await readDiskData(`./scripts/data/${filename}`)
  else data=[]
  await createDatabase(data)
}

const readDiskData=async (url)=>{
  console.log("fetching")
  const textData=await fetch(url).then(res=>res.text())
  let arrayData=textData.split("\n")
  return parseData(arrayData)
}

const parseData=(data)=>{
  let keys=data[0].split(";")
  console.log(keys)
  let records=[]
  for(let i=1;i<data.length;i++){
    let values=data[i].split(";")
    if(values!=undefined && values.length>1){
      let record={}
      for(let [j,k] of keys.entries()){
        if(k!="" && k!="\r") record[k]=values[j]
      }
      records.push(record)
    }
  }
  return records
}

const createDatabase=async (data)=>{
  let request=window.indexedDB.open(DATABASE_NAME,1)
  request.onupgradeneeded=(ev)=>{
    if(data){
      database=ev.target.result
      createStores(data)
    }
  }
  //no onsuccess, as opening isn't the goal of this function
  request.onerror=(ev)=>{
    console.error("CREATE DATABASE ERROR")
    console.log(ev.target.errorCode)
  }
}

const createStores=(data)=>{
  if(database!=undefined){
    console.log("CREATE STORES")
    let store=database.createObjectStore(DATABASE_RECORD_STORE_NAME,{keyPath:"id",autoIncrement:true})
    store.transaction.oncomplete=(ev)=>{
      if(data) addBulkDataInternal(data)
    }
  }
}

const addBulkDataInternal=(data)=>{
  // console.log("ADD BULK",data)
  let transaction=database.transaction([DATABASE_RECORD_STORE_NAME],"readwrite")
  let objectStore=transaction.objectStore(DATABASE_RECORD_STORE_NAME)
  for(let d of data){
    let request=objectStore.add(d)
  }
}


//get records
export const getRecords=async ()=>{
  if(await openDatabaseInternal()){
    let response=await getRecordsInternal()
    if(response.result) return response.records
    else{
      console.error(response.error)
    }
  }
}

export const getRecordsInternal=()=>new Promise((res,rej)=>{
  let transaction=database.transaction(DATABASE_RECORD_STORE_NAME)
  .objectStore(DATABASE_RECORD_STORE_NAME)
  .getAll()
  transaction.onsuccess=(ev)=>{
    res({result:true,records:ev.target.result})
  }
  transaction.onerror=(ev)=>{
    rej({result:false,error:ev.target.errorCode})
  }
})

//delete record
export const deleteEntry=async (id)=>{
  if(await openDatabaseInternal()){
    let response=await deleteEntryInternal(id)
    if(response.result){
      let event=new CustomEvent(DELETE_ENTRY_CONFIRM_EVENT,{detail:
        {
          id
        }
      })
      window.dispatchEvent(event)
    }else{
      console.error(response.error)
      return undefined
    }
  }
}
const deleteEntryInternal=(id)=>new Promise((res,rej)=>{
  let transaction=database.transaction([DATABASE_RECORD_STORE_NAME],"readwrite")
  .objectStore(DATABASE_RECORD_STORE_NAME)
  .delete(id)
  transaction.onsuccess=(ev)=>{
    res({result:true,id})
  }
  transaction.onerror=(ev)=>{
    rej({result:false,error:ev.target.errorCode})
  }
})

//add record
export const addEntry=async (data)=>{
  if(await openDatabaseInternal()){
    let response=await addEntryInternal(data)
    if(response.result){
      let event=new CustomEvent(ADD_ENTRY_CONFIRM_EVENT,{detail:
        {
          id:response.result.id,
          ...data
        }
      })
      window.dispatchEvent(event)
    }else{
      console.error(response.error)
      return undefined
    }
  }
}
const addEntryInternal=(data)=>new Promise((res,rej)=>{
  let transaction=database.transaction([DATABASE_RECORD_STORE_NAME],"readwrite")
  .objectStore(DATABASE_RECORD_STORE_NAME)
  .add(data)
  transaction.onsuccess=(ev)=>{
    res({result:true,id:ev.target.result})
  }
  transaction.onerror=(ev)=>{
    console.log("FAILED")
    rej({result:false,error:ev.target.errorCode})
  }
})



const openDatabaseInternal=()=>new Promise((res,rej)=>{
  if(database) res(true)
  else{
    let request=window.indexedDB.open(DATABASE_NAME,1)
    request.onsuccess=ev=>{
      database=ev.target.result
      res(true)
    }
    request.onerror=(ev)=>{
      res(false)
    }
    request.onupgradeneeded=(ev)=>{
      res(false)
    }
  }
})