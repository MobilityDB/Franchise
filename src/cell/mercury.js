import React from 'react'

const P = require('parsimmon')

const moment = require('moment')

/*const wkx = require('wkx')
const reproject = require('reproject')
const hash = require("object-hash")
const ColorHash = require("color-hash")
const unzip = require('unzip-array')*/

import Leaflet from 'leaflet';
//import '../util/leaflet-moving' ;
import {TemporalControl, TemporalMarker} from '../util/react-leaflet-moving'

import { Map, Marker, Popup, TileLayer, GeoJSON } from 'react-leaflet'

import { PostgisToGeoJSON } from "./postgis"

let whitespace = P.regexp(/\s*/m)
let token = p => p.skip(whitespace)
let word = str => P.string(str).thru(token)

const fmt = 'YYYY-MM-DD HH:mm:ss.SSSZZ'

const mercuryParser = P.createLanguage({
    TemporalInst: _ => P.seq(_.tValue, _.sep.then(_.time)).map(arr => ({
        value: PostgisToGeoJSON(arr[0]).coordinates.reverse(),
        timestamp: moment(arr[1], fmt).toDate().getTime()
    })),
    TemporalSeq: _ => P.seq(P.alt(_.lparen, _.lbracket), _.TemporalInst.sepBy1(_.comma), P.alt(_.rparen, _.rbracket)).map(arr => ({
        bounds: arr[0] + arr[2],
        instants: arr[1]
    })),
    tValue: _ => P.regexp(/[^@]+/).thru(token),
    time: _ => P.regexp(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?(\+\d+)?/).thru(token),
    sep: _ => word('@'),
    lbracket: _ => word('['),
    lparen: _ => word('('),
    rbracket: _ => word(']'),
    rparen: _ => word(')'),
    comma: _ => word(',')
});

export class MercuryVisualizer extends React.Component {
    static key = 'time';
    static desc = "Temporal View";
    static icon = <i className="fa fa-clock-o" aria-hidden="true"/>;
    static maxResults = 100

    constructor(props) {
        super(props) ;
        let link = document.createElement('link')
        link.type = 'text/css'
        link.rel = 'stylesheet'
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.2/leaflet.css'
        document.head.appendChild(link)
    }

    static test(result) {
        if(result.values.length < 1)
            return false ;

        return result.types.some(k => k === "tgeompointseq")
    }

    componentDidMount(){
        //console.log(this.refs.map)
        //console.log(this.trajs)
    }

    render(){
        let { result, view } = this.props;
        const animationDurationMillis = 10000 ;

        let trajs = [] ;
        let earliestTime = Number.MAX_VALUE
        let latestTime = 0
        for(let j = 0 ; j < result.values.length ; j ++) {
            const tseq = mercuryParser.TemporalSeq.tryParse(result.values[j][0])
            const initialTime = tseq.instants[0].timestamp
            const finalTime = tseq.instants[tseq.instants.length - 1].timestamp

            if(initialTime < earliestTime)
                earliestTime = initialTime
            if(finalTime > latestTime)
                latestTime = finalTime

            const initPos = tseq.instants[0].value

            let lastTime = tseq.instants[0].timestamp
            let traj =  {positions: [initPos], durations: []}

            const totalDuration = finalTime - lastTime
            const timeFactor = totalDuration / animationDurationMillis

            for(let i = 1; i < tseq.instants.length; i++) {
                traj.positions.push(tseq.instants[i].value)
                traj.durations.push((tseq.instants[i].timestamp - lastTime) / timeFactor)
                lastTime = tseq.instants[i].timestamp
            }

            trajs.push(traj)
        }

        return <div style={{width: '100%'}}><TemporalControl initialTimestamp={earliestTime} finalTimestamp={latestTime}/></div>
        /*return <div style={{width: '100%'}}><Map bounds={Leaflet.latLngBounds(trajs.map(t => t.positions))} ref={map => console.log("HELLO")} >
            <TileLayer
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            />
            {trajs.map(traj => <TemporalMarker durations={traj.durations} positions={traj.positions} key={JSON.stringify(traj)}/> )}
        </Map></div>*/
    }
}

