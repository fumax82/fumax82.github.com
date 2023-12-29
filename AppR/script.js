const container=document.getElementById("container")

const createWeek=(week=undefined)=>{
    let row=document.createElement("div")
    row.classList.add("row")

    for(let i=0;i<7;i++){
        let tile=document.createElement("div")
        tile.classList.add("tile")
        tile.innerHTML=`Giorno ${i} \n sett. ${week}`

        tile.addEventListener("mouseup",(ev)=>{
            if(ev.button==0){
                tile.classList.toggle("open")
            }else if(ev.button==1 && tile.classList.contains("open")){
                tile.classList.toggle("extended")
            }
        })

        row.append(tile)
    }

    container.append(row)
}

createWeek("A")
createWeek("B")
createWeek("C")
createWeek("D")