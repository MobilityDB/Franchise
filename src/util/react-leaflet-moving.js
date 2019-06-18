import React from 'react'

import {MapLayer, MapControl} from 'react-leaflet'
import PropTypes from 'prop-types'

import Leaflet from 'leaflet'
import './leaflet-moving'

import Slider from 'rc-slider'
import 'rc-slider/assets/index.css'

import './temporal.less'

export class TemporalControl extends React.Component {
    static propTypes = {
        realDuration: PropTypes.number,
        initialTimestamp: PropTypes.number.isRequired,
        finalTimestamp: PropTypes.number.isRequired,
    }

    static defaultProps = {
        realDuration: 10000,
    }

    static timestampToString(ts) {
        return new Date(ts).toString()
    }

    constructor(props) {
        super(props)
        this.state = {
            timePosition: 0.0,
            playing: false
        }
    }

    timeAt(pos) {
        return this.props.initialTimestamp + (this.props.finalTimestamp - this.props.initialTimestamp) * pos
    }

    currentTime() {
        return this.timeAt(this.state.timePosition)
    }

    render() {
        let TipSlider = Slider.createSliderWithTooltip(Slider)
        let _this = this

        return <div className="temporal-control" style={{width: '100%'}}>
            <i className="fa fa-play"/>
            <i className="fa fa-pause"/>
            <TipSlider min={0} max={1000} onAfterChange={x => {console.log(x); _this.setState({timePosition: x / 1000})}} tipFormatter={x => TemporalControl.timestampToString(this.timeAt(x / 1000))}/>
            <span>{TemporalControl.timestampToString(this.currentTime())}</span>
        </div>
    }
}

export class TemporalMarker extends MapLayer {
    static propTypes = {
        durations: PropTypes.array.isRequired,
        positions: PropTypes.array.isRequired,
        autostart: PropTypes.bool,
        loop: PropTypes.bool
    }

    static defaultProps = {
        autostart: true,
        loop: false
    }

    createLeafletElement(props) {
        return Leaflet.Marker.movingMarker(props.positions, props.durations, props)
    }

    updateLeafletElement(fromProps, toProps) {
        if(JSON.stringify(fromProps.positions) !== JSON.stringify(toProps.positions) || JSON.stringify(fromProps.durations) !== JSON.stringify(toProps.durations)) {
            this.leafletElement.initialize(toProps.positions, toProps.durations, toProps)
        }
    }
}


