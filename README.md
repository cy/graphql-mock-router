# GraphQL Mock Router

This Router is a POC for mocking subgraph requests with AI.

This repo runs a coprocessor and Router. The router passes off subgraph requests to the coprocessor, which handles the AI agent integration and bypasses actual subgraph requests.

You can [learn more about coprocessors here](https://www.apollographql.com/docs/router/customizations/coprocessor/).

## Installation

Install node modules:

```
yarn
```

[Install router] by running the following:

You can download the latest version with following command:

```shell
curl -sSL https://router.apollo.dev/download/nix/latest | sh
```

## Running the Router

### Include your supergraph schema

Add your supergraph schema to the root directory of this repo under the name `supergraph-schema.graphql`.

### Start the coprocessor

```
yarn start:coprocessor
```

### Start the Router

```
APOLLO_KEY=<APOLLO KEY> yarn start:router
```
