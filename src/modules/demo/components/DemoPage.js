import React from 'react'
import {connect} from 'react-redux'
import * as demoActions from '../actions'
import {Layout} from '../../common'

class DemoPage extends React.Component{
	render(){
		const {
			count, 
			decrease, 
			increase
		} = this.props

		return <Layout>
			<h4>Count: {count}</h4>
			<button onClick={increase}>Increase</button>
			<button onClick={decrease}>Decrease</button>
		</Layout>
	}
}

export default connect(state => ({
	count: state.demo.count
}), dispatch => ({
	decrease: () => dispatch(demoActions.decrease()),
	increase: () => dispatch(demoActions.increase())
}))(DemoPage)