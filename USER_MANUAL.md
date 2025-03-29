# Automata Controls Building Management System - User Manual

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
   - [System Requirements](#system-requirements)
   - [Installation](#installation)
   - [First Login](#first-login)
3. [System Configuration](#system-configuration)
   - [Firebase Configuration](#firebase-configuration)
   - [Weather API Configuration](#weather-api-configuration)
   - [Control Server Configuration](#control-server-configuration)
   - [Notification Settings](#notification-settings)
4. [User Management](#user-management)
   - [User Roles](#user-roles)
   - [Adding Users](#adding-users)
   - [Editing Users](#editing-users)
5. [Location Management](#location-management)
   - [Adding Locations](#adding-locations)
   - [Editing Locations](#editing-locations)
6. [Equipment Management](#equipment-management)
   - [Equipment Types](#equipment-types)
   - [Adding Equipment](#adding-equipment)
   - [Configuring Equipment](#configuring-equipment)
7. [Dashboard](#dashboard)
   - [Overview](#overview)
   - [Location Cards](#location-cards)
   - [Equipment Cards](#equipment-cards)
8. [Controls](#controls)
   - [Authentication](#authentication)
   - [Applying Changes](#applying-changes)
   - [Saving Changes](#saving-changes)
9. [Analytics](#analytics)
   - [Time Ranges](#time-ranges)
   - [Data Types](#data-types)
   - [Chart Types](#chart-types)
10. [Alarms](#alarms)
    - [Alarm Configuration](#alarm-configuration)
    - [Active Alarms](#active-alarms)
    - [Alarm History](#alarm-history)
11. [Socket.IO and MQTT Bridge](#socketio-and-mqtt-bridge)
    - [Server Setup](#server-setup)
    - [Message Format](#message-format)
12. [Troubleshooting](#troubleshooting)
    - [Connection Issues](#connection-issues)
    - [Authentication Issues](#authentication-issues)
    - [Data Not Displaying](#data-not-displaying)
13. [System Expansion](#system-expansion)
    - [Adding New Equipment Types](#adding-new-equipment-types)
    - [Custom Controls](#custom-controls)
    - [Integration with Other Systems](#integration-with-other-systems)

## Introduction

The Automata Controls Building Management System is a comprehensive solution for monitoring and controlling various types of building equipment. The system provides real-time monitoring, control capabilities, analytics, and alarm management for equipment such as air handlers, boilers, chillers, and more.

## Getting Started

### System Requirements

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Node.js 14.x or higher (for server components)
- Firebase account
- OpenWeatherMap API key (optional, for weather display)

### Installation

1. Clone the repository:

