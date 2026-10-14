import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import './studio.css';
class ErrorBoundary extends React.Component {
  state={error:null};
  static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<main className="fatal"><h1>页面暂时遇到问题</h1><p>{this.state.error.message}</p><button onClick={()=>location.reload()}>重新打开</button></main>:this.props.children;}
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
