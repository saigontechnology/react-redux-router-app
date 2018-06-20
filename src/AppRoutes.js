import React from 'react'
import { Route, Switch } from 'react-router-dom';
import * as demo from './modules/demo'
import * as common from './modules/common'

export function AppRoutes(){
  return <Switch>
    <Route path="/demo" component={demo.DemoPage}/>

    <Route path="*" component={common.Page404}/>
  </Switch>
}