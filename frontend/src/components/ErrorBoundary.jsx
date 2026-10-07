import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) {
      return <div className="container" role="alert" style={{ paddingTop: '8rem' }}>
        <h2>The page could not display the result</h2>
        <p>Please reload the page and try again.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>;
    }
    return this.props.children;
  }
}
