const tapIntervals={
	short:250,
	long:1000,
	tapTolerance:30,
	swipe:750,
	swipeTolerance:200,//as a minimum
}

const cursor={
	isDown:false,
	lastDown:undefined,
	lastPos:undefined
}

const listenerOptions={
	swipe:false
}

const callbacks={
	shortTap:undefined,
	longTap:undefined
}

export function setListeners(element,callbacks=undefined,options=undefined){
	if(options!=undefined) listenerOptions.swipe=options.swipe
	if(callbacks!=undefined){
		callbacks.shortTap=callbacks.shortTap
		callbacks.longTap=callbacks.longTap
	}
	
	element.addEventListener("pointerdown",(ev)=>{

		cursor.isDown=true
		cursor.lastDown=ev.timeStamp
		cursor.lastPos=[ev.pageX,ev.pageY]
	})
	element.addEventListener("pointerup",(ev)=>{
		ev.preventDefault()

		if(cursor.isDown){
			let deltaX=ev.pageX-cursor.lastPos[0]
			let deltaY=ev.pageY-cursor.lastPos[1]
			let distance=Math.hypot(deltaX, deltaY)
			let deltaTime=ev.timeStamp-cursor.lastDown
			
			if(distance<tapIntervals.tapTolerance){
				if(callbacks.shortTap && deltaTime<tapIntervals.short) callbacks.shortTap()
				else if(callbacks.longTap && deltaTime<tapIntervals.long) callbacks.longTap()
			}else if(listenerOptions.swipe && deltaTime<tapIntervals.swipe && Math.abs(deltaX)>tapIntervals.swipeTolerance && Math.abs(deltaY)<tapIntervals.swipeTolerance){
				if(deltaX>0) console.log("SWIPE RIGHT")
				else if(deltaX<0) console.log("SWIPE LEFT")
			}
			cursor.isDown=false
			cursor.lastDown=undefined
			cursor.lastPos=undefined
		}
	})
}