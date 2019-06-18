import React from 'react'
import ReactDOM from 'react-dom'

const wkx = require('wkx')
const reproject = require('reproject')
const hash = require("object-hash")
const ColorHash = require("color-hash")

import Leaflet from 'leaflet';
import { Map, FeatureGroup, TileLayer, GeoJSON } from 'react-leaflet'

import Slider from 'rc-slider'
import Tooltip from 'rc-tooltip'
import 'rc-slider/assets/index.css'

import '../util/temporal.less'

const bbox = require('geojson-bounds')

const projections = {
	'5676': '+proj=tmerc +lat_0=0 +lon_0=6 +k=1 +x_0=2500000 +y_0=0 +ellps=bessel +towgs84=598.1,73.7,418.2,0.202,0.045,-2.455,6.7 +units=m +no_defs'
}

const Handle = Slider.Handle;

const handle = (props) => {
    const { value, dragging, index, ...restProps } = props;
    return (
        <Tooltip
            prefixCls="rc-slider-tooltip"
            overlay={value}
            visible={dragging}
            placement="top"
            key={index}
        >
            <Handle value={value} {...restProps} />
        </Tooltip>
    );
};

export function PostgisToGeoJSON(pgvalue) {
    let buf = Buffer(pgvalue, 'hex')
    let geom = wkx.Geometry.parse(buf)
    let gj = geom.toGeoJSON()
    if(geom.srid != 4326 && projections[geom.srid]) {
        gj = reproject.toWgs84(gj, projections[geom.srid])
    }
    return gj
}

export class PostgisVisualizer extends React.Component {
    static key = 'map';
    static desc = "Map View";
    static icon = <i className="fa fa-map-marker" aria-hidden="true"/>;
    static maxResults = 100

	constructor(props) {
		super(props) ;
        let link = document.createElement('link')
		link.type = 'text/css'
		link.rel = 'stylesheet'
		link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.0.2/leaflet.css'
		document.head.appendChild(link)
		this.state = {showRow: 1, showAll: true}
	}

	static typeIsPostgis(typ) {
		return typ === "geography" || typ === "geometry"
	}

    static test(result) {
		if(result.values.length < 1)
			return false ;

		return result.types.some(this.typeIsPostgis)
    }

    componentDidMount(){
    }

    seek(offset) {
    	let result = this.state.showRow + offset
		let count = this.props.result.values.length
		result = result < 1 ? 1 : result
		result = result > count ? count : result
		this.setState({showRow: result})
	}

    render(){
        let { result, view } = this.props;

        const ch = new ColorHash()

        let json = {}
        let count = result.values.length > PostgisVisualizer.maxResults ? PostgisVisualizer.maxResults : result.values.length
        let pgCols = {}
        if(count > 0) {
            for(let i = 0 ; i < result.columns.length ; i ++) {
                if(PostgisVisualizer.typeIsPostgis(result.types[i])) {
                    pgCols[i] = ch.hex(result.columns[i])
                }
            }
        }

        if(this.state.showRow > count)
        	this.setState({showRow: count})

		let [start, end] = this.state.showAll ? [0, count] : [this.state.showRow - 1, this.state.showRow]
		let bounds = null
		for(let i = 0 ; i < result.columns.length ; i ++) {
			if(pgCols[i]) {
				json[pgCols[i]] = []
				for(let j = start ; j < end ; j ++) {
					try {
                        let gj = PostgisToGeoJSON(result.values[j][i])
                        let b = bbox.extent(gj)
                        if (!bounds)
                            bounds = L.latLngBounds([b[1], b[0]], [b[3], b[2]])
                        else
                            bounds = bounds.extend(L.latLngBounds([b[1], b[0]], [b[3], b[2]]))
                        gj.color = pgCols[i]
                        gj.properties = {}
                        for (let l = 0; l < result.columns.length; l++) {
                            if (!pgCols[l])
                                gj.properties[result.columns[l]] = result.values[j][l]

                        }
                        json[pgCols[i]].unshift(gj)
                    } catch(_) {}
				}
			}
		}

		if(bounds === null)
			bounds = [[0, 0], [0, 0]]

		function onEachFeature(feature, layer) {
		    const popup = Leaflet.popup().setContent(Object.entries(feature.properties).map(arr => `${arr[0]}: ${arr[1]}`).join('<br/>')) ;
			function setColor(c) {
		    	if(layer.setStyle) {
		    		layer.setStyle({color: c})
				}
			}
	        layer.bindPopup(popup).on('popupopen', () => setColor('red')).on('popupclose', () => setColor(feature.color))
		}

		function pointToLayer(point, latlng) {
        	return L.circleMarker(latlng, {color: point.color, radius: 6})
		}

        return <div style={{width: '100%'}}>
			<div style={{margin: '4px', padding: '4px', width: '100%'}}>
				<label><input type="radio" value="1" checked={this.state.showAll} onChange={e => this.setState({showAll: e.target.value === "1"})}/> Show all rows</label>&nbsp;
                <label><input type="radio" value="0" checked={! this.state.showAll} onChange={e => this.setState({showAll: e.target.value === "1"})}/> Show specific row</label>
				<div className="row-select" style={{display: this.state.showAll ? 'none' : 'flex'}}>
                    <i className="fa fa-fast-backward" onClick={_ => this.seek(-10)}/><i className="fa fa-step-backward" onClick={_ => this.seek(-1)}/>
					<span className="row-current">{this.state.showRow}</span>
					<i className="fa fa-step-forward" onClick={_ => this.seek(1)}/><i className="fa fa-fast-forward" onClick={_ => this.seek(10)}/>
					<Slider value={this.state.showRow} handle={handle} min={1} max={result.values.length} onChange={row => this.setState({showRow: row})}/>
                </div>
			</div>
            <span style={{display: this.state.showAll && result.values.length > count ? 'block' : 'none'}}>Showing only the {count} first rows for performance reasons</span>
            <span className="color-legend">{
                Object.entries(pgCols).map(col => <span><span className="color-square" style={{backgroundColor: col[1]}}></span> {result.columns[col[0]]}</span>)            
            }</span>
			<Map bounds={bounds}>
                <TileLayer
                    url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
                />
				{Object.entries(json).map(col => <GeoJSON data={col[1]} key={hash(col[1])} style={{color: col[0]}} onEachFeature={onEachFeature} pointToLayer={pointToLayer} />)}
            </Map></div> ;
    }
    //TODO: color legend
}

