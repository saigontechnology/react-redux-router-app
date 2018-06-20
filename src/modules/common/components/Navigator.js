import React from "react";
import { push } from "connected-react-router";
import { connect } from "react-redux";
import styled from "styled-components";

class Navigator extends React.Component {
  goTo = path => this.props.dispatch(push(path))

  render() {
    return (
      <div>
        <NavItem onClick={() => this.goTo("/demo")}>Home</NavItem>{" "}
        <NavItem onClick={() => this.goTo("/404")}>404</NavItem>
      </div>
    );
  }
}

export default connect()(Navigator);

const NavItem = styled.a`
  cursor: pointer;
  text-decoration: underline;
`;
