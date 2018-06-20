import React from "react";
import styled from "styled-components";
import Navigator from "./Navigator";

export class Layout extends React.Component {
  render() {
    return (
      <Wrapper>
        <Navigator />
        {this.props.children}
      </Wrapper>
    );
  }
}

const Wrapper = styled.div`
  text-align: center;
`;
