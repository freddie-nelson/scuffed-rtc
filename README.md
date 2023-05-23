# Scuffed RTC

## What is this?

This is a simple library built on top of socket.io for communication between clients through a middleware server. It is meant to be used for simple applications that require real-time communication between clients but no server-side logic.

Clients can join one namespace and then access, create and join rooms within that namespace. Clients can then send messages to other clients in the same room.

## Why?

I wanted to make a simple library that could be used for real-time communication between clients while minimizing the amount of server-side logic performed, to minimize server costs and resources required.

## What for?

This library will be used for all of the simple turn-based games I make in the future, where one client can act as the host and take the role traditionally performed by a server.
