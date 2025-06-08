# Automata Controls Nexus InfluxDB3 Alert Engine Plugin
# Version: 1.0.0
# Author: Juelz @ Automata Controls
# Created: June 8, 2025
# Updated: June 8, 2025
#
# CHANGELOG:
# v1.0.0 (June 8, 2025) Initial release with Resend API integration and multi-channel alerting
#
# PURPOSE:
# Advanced alerting system that monitors equipment conditions, predictive maintenance alerts,
# energy optimization opportunities, and system health issues with real-time notifications
# via Resend email, Slack, Discord, and custom HTTP endpoints.
#
# FEATURES:
# Real-time equipment alert monitoring
# Resend API email integration
# Multi-channel notifications (Email, Slack, Discord, HTTP)
# Critical equipment failure alerts
# Predictive maintenance notifications
# Energy optimization alerts
# System health monitoring
# Alert history tracking and analytics
# Customizable alert thresholds and conditions

import json
import time
import os
import base64
from datetime import datetime
from typing import Dict, List, Any, Optional
import httpx

# Alert configuration
ALERT_CONFIG = {
    "bms_api_timeout": 15,
    "slack_webhook_timeout": 10,
    "discord_webhook_timeout": 10,
    "retry_attempts": 3,
    "retry_backoff": 2.0,
    "alert_cooldown_minutes": 5
}

# Equipment alert thresholds
EQUIPMENT_ALERT_THRESHOLDS = {
    "boiler": {
        "critical_temp": 200.0,
        "high_temp": 180.0,
        "low_efficiency": 70.0,
        "high_pressure": 150.0
    },
    "chiller": {
        "critical_temp": 55.0,
        "high_temp": 50.0,
        "low_efficiency": 65.0,
        "low_refrigerant": 20.0
    },
    "air-handler": {
        "critical_temp": 90.0,
        "high_temp": 85.0,
        "low_airflow": 500.0,
        "filter_pressure_diff": 2.0
    },
    "pump": {
        "critical_temp": 130.0,
        "high_temp": 120.0,
        "low_pressure": 10.0,
        "high_vibration": 5.0
    },
    "fancoil": {
        "critical_temp": 95.0,
        "high_temp": 90.0,
        "low_efficiency": 60.0
    }
}

# Global state for alert tracking
alert_history = {}
last_alert_times = {}

def process_writes(influxdb3_local, table_batches, args=None):
    """
    Main entry point for Automata Controls Alert Engine Plugin
    
    Monitors equipment conditions, predictive maintenance alerts, energy optimization
    opportunities, and system health issues with real-time notifications.
    """
    try:
        influxdb3_local.info("[Alert Engine] Processing Engine triggered")
        
        # Parse arguments
        alert_config = parse_alert_arguments(args)
        
        alerts_generated = 0
        notifications_sent = 0
        
        for table_batch in table_batches:
            table_name = table_batch.get("table_name", "")
            rows = table_batch.get("rows", [])
            
            # Monitor different types of data
            if table_name == "metrics":
                # Monitor equipment sensor data
                for row in rows:
                    alert_result = process_equipment_alerts(influxdb3_local, row, alert_config)
                    if alert_result:
                        alerts_generated += 1
                        if send_alert_notification(influxdb3_local, alert_result, alert_config):
                            notifications_sent += 1
                            
            elif table_name == "equipment_health":
                # Monitor predictive maintenance alerts
                for row in rows:
                    alert_result = process_health_alerts(influxdb3_local, row, alert_config)
                    if alert_result:
                        alerts_generated += 1
                        if send_alert_notification(influxdb3_local, alert_result, alert_config):
                            notifications_sent += 1
                            
            elif table_name == "energy_consumption":
                # Monitor energy optimization alerts
                for row in rows:
                    alert_result = process_energy_alerts(influxdb3_local, row, alert_config)
                    if alert_result:
                        alerts_generated += 1
                        if send_alert_notification(influxdb3_local, alert_result, alert_config):
                            notifications_sent += 1
        
        influxdb3_local.info(f"[Alert Engine] Generated {alerts_generated} alerts, sent {notifications_sent} notifications")
        
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Plugin error: {e}")

def process_equipment_alerts(influxdb3_local, row: Dict, alert_config: Dict) -> Optional[Dict]:
    """
    Process equipment sensor data for critical alerts
    """
    try:
        equipment_id = row.get("equipmentId")
        location_id = row.get("location_id")
        
        influxdb3_local.info(f"[Alert Engine] Processing equipment: {equipment_id}, location: {location_id}")
        influxdb3_local.info(f"[Alert Engine] Row data: {row}")
        
        if not equipment_id or not location_id:
            influxdb3_local.info(f"[Alert Engine] Missing equipment_id or location_id")
            return None
        
        # Determine equipment type
        equipment_type = determine_equipment_type(equipment_id)
        thresholds = EQUIPMENT_ALERT_THRESHOLDS.get(equipment_type, {})
        
        influxdb3_local.info(f"[Alert Engine] Equipment type: {equipment_type}, thresholds: {thresholds}")
        
        # Check for critical conditions
        alerts = []
        
        # Temperature alerts
        temperature = row.get("temperature", row.get("Water_Temp", row.get("Supply_Temp", 0)))
        influxdb3_local.info(f"[Alert Engine] Temperature found: {temperature}")
        
        if temperature and isinstance(temperature, (int, float)):
            influxdb3_local.info(f"[Alert Engine] Checking temperature {temperature} against thresholds")
            
            if temperature > thresholds.get("critical_temp", 999):
                influxdb3_local.info(f"[Alert Engine] CRITICAL TEMPERATURE ALERT: {temperature} > {thresholds.get('critical_temp')}")
                alerts.append({
                    "severity": "CRITICAL",
                    "type": "HIGH_TEMPERATURE",
                    "message": f"CRITICAL: {equipment_type} {equipment_id} temperature {temperature}°F exceeds critical threshold {thresholds['critical_temp']}°F",
                    "value": temperature,
                    "threshold": thresholds["critical_temp"]
                })
            elif temperature > thresholds.get("high_temp", 999):
                influxdb3_local.info(f"[Alert Engine] HIGH TEMPERATURE WARNING: {temperature} > {thresholds.get('high_temp')}")
                alerts.append({
                    "severity": "WARNING", 
                    "type": "HIGH_TEMPERATURE",
                    "message": f"WARNING: {equipment_type} {equipment_id} temperature {temperature}°F exceeds high threshold {thresholds['high_temp']}°F",
                    "value": temperature,
                    "threshold": thresholds["high_temp"]
                })
        else:
            influxdb3_local.info(f"[Alert Engine] No valid temperature found in data")
        
        # Return the most severe alert if any
        if alerts:
            # Sort by severity (CRITICAL first)
            alerts.sort(key=lambda x: 0 if x["severity"] == "CRITICAL" else 1)
            
            alert = alerts[0]
            alert.update({
                "equipment_id": equipment_id,
                "location_id": location_id,
                "equipment_type": equipment_type,
                "timestamp": datetime.now().isoformat(),
                "source": "equipment_monitoring"
            })
            
            influxdb3_local.info(f"[Alert Engine] Generated alert: {alert}")
            return alert
        
        influxdb3_local.info(f"[Alert Engine] No alerts generated for equipment {equipment_id}")
        return None
        
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Equipment alert processing error: {e}")
        return None

def process_health_alerts(influxdb3_local, row: Dict, alert_config: Dict) -> Optional[Dict]:
    """
    Process predictive maintenance health alerts
    """
    try:
        equipment_id = row.get("equipment_id")
        location_id = row.get("location_id")
        health_score = row.get("health_score", 100)
        health_status = row.get("health_status", "unknown")
        
        if not equipment_id or not isinstance(health_score, (int, float)):
            return None
        
        # Critical health alerts
        if health_score < 20:
            return {
                "equipment_id": equipment_id,
                "location_id": location_id,
                "severity": "CRITICAL",
                "type": "EQUIPMENT_HEALTH_CRITICAL",
                "message": f"CRITICAL: Equipment {equipment_id} health score {health_score:.1f}% - Immediate maintenance required",
                "value": health_score,
                "threshold": 20,
                "health_status": health_status,
                "timestamp": datetime.now().isoformat(),
                "source": "predictive_maintenance"
            }
        elif health_score < 40:
            return {
                "equipment_id": equipment_id,
                "location_id": location_id,
                "severity": "WARNING",
                "type": "EQUIPMENT_HEALTH_LOW",
                "message": f"WARNING: Equipment {equipment_id} health score {health_score:.1f}% - Schedule maintenance soon",
                "value": health_score,
                "threshold": 40,
                "health_status": health_status,
                "timestamp": datetime.now().isoformat(),
                "source": "predictive_maintenance"
            }
        
        return None
        
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Health alert processing error: {e}")
        return None

def process_energy_alerts(influxdb3_local, row: Dict, alert_config: Dict) -> Optional[Dict]:
    """
    Process energy optimization alerts
    """
    try:
        location_id = row.get("location_id")
        total_power_kw = row.get("total_power_kw", 0)
        hourly_cost = row.get("hourly_cost", 0)
        average_efficiency = row.get("average_efficiency", 100)
        
        if not location_id:
            return None
        
        # High energy consumption alert
        if isinstance(total_power_kw, (int, float)) and total_power_kw > 500:
            return {
                "location_id": location_id,
                "severity": "WARNING",
                "type": "HIGH_ENERGY_CONSUMPTION",
                "message": f"WARNING: Location {location_id} high energy consumption {total_power_kw:.1f} kW (${hourly_cost:.2f}/hour)",
                "value": total_power_kw,
                "threshold": 500,
                "hourly_cost": hourly_cost,
                "timestamp": datetime.now().isoformat(),
                "source": "energy_optimization"
            }
        
        # Low efficiency alert
        if isinstance(average_efficiency, (int, float)) and average_efficiency < 70:
            return {
                "location_id": location_id,
                "severity": "WARNING",
                "type": "LOW_ENERGY_EFFICIENCY",
                "message": f"WARNING: Location {location_id} low energy efficiency {average_efficiency:.1f}% - Optimization opportunities available",
                "value": average_efficiency,
                "threshold": 70,
                "total_power_kw": total_power_kw,
                "timestamp": datetime.now().isoformat(),
                "source": "energy_optimization"
            }
        
        return None
        
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Energy alert processing error: {e}")
        return None

def send_alert_notification(influxdb3_local, alert: Dict, alert_config: Dict) -> bool:
    """
    Send alert notification via configured channels
    """
    try:
        # Check cooldown period
        alert_key = f"{alert.get('equipment_id', alert.get('location_id', 'unknown'))}_{alert['type']}"
        current_time = time.time()
        
        if alert_key in last_alert_times:
            time_since_last = current_time - last_alert_times[alert_key]
            cooldown_seconds = ALERT_CONFIG["alert_cooldown_minutes"] * 60
            
            if time_since_last < cooldown_seconds:
                influxdb3_local.info(f"[Alert Engine] Alert {alert_key} in cooldown period, skipping notification")
                return False
        
        # Update last alert time
        last_alert_times[alert_key] = current_time
        
        # Send to configured channels
        notification_sent = False
        
        # Send via existing BMS API (uses your Resend setup)
        if send_resend_notification(influxdb3_local, alert, alert_config):
            notification_sent = True
        
        # Send via Slack (if configured)
        slack_webhook = alert_config.get("slack_webhook_url") or os.getenv("SLACK_WEBHOOK_URL")
        if slack_webhook:
            if send_slack_notification(influxdb3_local, alert, slack_webhook):
                notification_sent = True
        
        # Send via Discord (if configured)
        discord_webhook = alert_config.get("discord_webhook_url") or os.getenv("DISCORD_WEBHOOK_URL")
        if discord_webhook:
            if send_discord_notification(influxdb3_local, alert, discord_webhook):
                notification_sent = True
        
        # Write alert to history database
        if alert_config.get("alerts_db"):
            write_alert_history(influxdb3_local, alert, alert_config)
        
        return notification_sent
        
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Notification sending error: {e}")
        return False

def send_resend_notification(influxdb3_local, alert: Dict, alert_config: Dict) -> bool:
    """
    Send alert notification via your existing BMS API endpoint
    """
    try:
        # Get API endpoint URL
        api_base_url = alert_config.get("api_base_url") or os.getenv("NEXT_PUBLIC_BRIDGE_URL", "https://neuralbms.automatacontrols.com")
        api_endpoint = f"{api_base_url}/api/send-alarm-email"
        
        # Get recipient email
        recipient_email = alert_config.get("recipient_email") or os.getenv("DEFAULT_RECIPIENT")
        if not recipient_email:
            influxdb3_local.warning("[Alert Engine] Recipient email not configured")
            return False
        
        # Convert alert to alarm format for your existing API
        alarm_payload = {
            "alarmType": alert["type"].replace("_", " ").title(),
            "details": alert["message"],
            "locationId": alert.get("location_id", "unknown"),
            "locationName": f"Location {alert.get('location_id', 'Unknown')}",
            "equipmentName": alert.get("equipment_id", "System Component"),
            "alarmId": f"ai-alert-{int(time.time())}",
            "severity": alert["severity"].lower(),
            "recipients": [recipient_email],
            "assignedTechs": "AI Processing Engine",
            # Additional alert context
            "alertContext": {
                "source": alert["source"],
                "equipment_type": alert.get("equipment_type", "unknown"),
                "value": alert.get("value", 0),
                "threshold": alert.get("threshold", 0),
                "timestamp": alert["timestamp"],
                "health_status": alert.get("health_status"),
                "hourly_cost": alert.get("hourly_cost"),
                "total_power_kw": alert.get("total_power_kw")
            }
        }
        
        # Send request with retry logic
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AutomataControls-AlertEngine/1.0"
        }
        
        for attempt in range(ALERT_CONFIG["retry_attempts"]):
            try:
                with httpx.Client(timeout=ALERT_CONFIG["bms_api_timeout"]) as client:
                    response = client.post(
                        api_endpoint,
                        json=alarm_payload,
                        headers=headers
                    )
                
                if response.status_code == 200:
                    result = response.json()
                    message_id = result.get("messageId")
                    summary = result.get("summary", {})
                    successful = summary.get("successful", 0)
                    
                    influxdb3_local.info(f"[Alert Engine] Email sent via BMS API: {message_id}, {successful} recipients")
                    return True
                else:
                    error_text = response.text
                    influxdb3_local.error(f"[Alert Engine] BMS API error {response.status_code}: {error_text}")
                    
            except Exception as e:
                influxdb3_local.error(f"[Alert Engine] BMS API request error (attempt {attempt + 1}): {e}")
                
                if attempt < ALERT_CONFIG["retry_attempts"] - 1:
                    time.sleep(ALERT_CONFIG["retry_backoff"] ** attempt)
        
        return False
        
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] BMS API notification error: {e}")
        return False

def send_slack_notification(influxdb3_local, alert: Dict, webhook_url: str) -> bool:
    """
    Send alert notification to Slack
    """
    try:
        # Format Slack message
        color = "danger" if alert["severity"] == "CRITICAL" else "warning"
        
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"{alert['severity']} Alert - {alert['type'].replace('_', ' ').title()}",
                    "text": alert["message"],
                    "fields": [
                        {
                            "title": "Equipment ID" if "equipment_id" in alert else "Location ID",
                            "value": alert.get("equipment_id", alert.get("location_id", "Unknown")),
                            "short": True
                        },
                        {
                            "title": "Timestamp",
                            "value": alert["timestamp"],
                            "short": True
                        },
                        {
                            "title": "Source",
                            "value": alert["source"].replace("_", " ").title(),
                            "short": True
                        }
                    ],
                    "footer": "Automata Controls Nexus BMS",
                    "ts": int(time.time())
                }
            ]
        }
        
        # Send request
        with httpx.Client(timeout=ALERT_CONFIG["slack_webhook_timeout"]) as client:
            response = client.post(webhook_url, json=payload)
        
        if response.status_code == 200:
            influxdb3_local.info("[Alert Engine] Slack notification sent successfully")
            return True
        else:
            influxdb3_local.error(f"[Alert Engine] Slack webhook error {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Slack notification error: {e}")
        return False

def send_discord_notification(influxdb3_local, alert: Dict, webhook_url: str) -> bool:
    """
    Send alert notification to Discord
    """
    try:
        # Format Discord message
        color = 0xff0000 if alert["severity"] == "CRITICAL" else 0xffa500  # Red for critical, orange for warning
        
        payload = {
            "embeds": [
                {
                    "title": f"{alert['severity']} Alert",
                    "description": alert["message"],
                    "color": color,
                    "fields": [
                        {
                            "name": "Equipment ID" if "equipment_id" in alert else "Location ID",
                            "value": alert.get("equipment_id", alert.get("location_id", "Unknown")),
                            "inline": True
                        },
                        {
                            "name": "Alert Type",
                            "value": alert["type"].replace("_", " ").title(),
                            "inline": True
                        },
                        {
                            "name": "Source",
                            "value": alert["source"].replace("_", " ").title(),
                            "inline": True
                        }
                    ],
                    "footer": {
                        "text": "Automata Controls Nexus BMS"
                    },
                    "timestamp": alert["timestamp"]
                }
            ]
        }
        
        # Send request
        with httpx.Client(timeout=ALERT_CONFIG["discord_webhook_timeout"]) as client:
            response = client.post(webhook_url, json=payload)
        
        if response.status_code == 204:
            influxdb3_local.info("[Alert Engine] Discord notification sent successfully")
            return True
        else:
            influxdb3_local.error(f"[Alert Engine] Discord webhook error {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Discord notification error: {e}")
        return False

def write_alert_history(influxdb3_local, alert: Dict, alert_config: Dict):
    """
    Write alert to history database for tracking and analytics
    """
    try:
        timestamp = int(time.time() * 1_000_000_000)
        
        # Create line protocol for alert history
        measurement = "alert_history"
        
        tags = {
            "alert_type": alert["type"],
            "severity": alert["severity"],
            "source": alert["source"]
        }
        
        if "equipment_id" in alert:
            tags["equipment_id"] = alert["equipment_id"]
        if "location_id" in alert:
            tags["location_id"] = alert["location_id"]
        if "equipment_type" in alert:
            tags["equipment_type"] = alert["equipment_type"]
        
        fields = {
            "message": alert["message"],
            "value": alert.get("value", 0),
            "threshold": alert.get("threshold", 0)
        }
        
        # Additional fields based on alert source
        if alert["source"] == "predictive_maintenance":
            fields["health_status"] = alert.get("health_status", "unknown")
        elif alert["source"] == "energy_optimization":
            fields["hourly_cost"] = alert.get("hourly_cost", 0)
            fields["total_power_kw"] = alert.get("total_power_kw", 0)
        
        # Build line protocol
        line_protocol = create_line_protocol(measurement, tags, fields, timestamp)
        influxdb3_local.write(line_protocol)
        
        influxdb3_local.info(f"[Alert Engine] Alert written to history database")
        
    except Exception as e:
        influxdb3_local.error(f"[Alert Engine] Alert history write error: {e}")

# Helper functions
def parse_alert_arguments(args) -> Dict:
    """Parse alert configuration arguments"""
    config = {}
    
    if args:
        # If args is already a dictionary (from trigger arguments), use it directly
        if isinstance(args, dict):
            return args
        # If args is a string, parse it
        elif isinstance(args, str):
            for arg in args.split(","):
                if "=" in arg:
                    key, value = arg.split("=", 1)
                    config[key.strip()] = value.strip()
    
    return config

def determine_equipment_type(equipment_id: str) -> str:
    """Determine equipment type from equipment ID"""
    equipment_id_lower = equipment_id.lower()
    
    if "boiler" in equipment_id_lower:
        return "boiler"
    elif "chiller" in equipment_id_lower:
        return "chiller"
    elif "pump" in equipment_id_lower:
        return "pump"
    elif "ahu" in equipment_id_lower or "air" in equipment_id_lower:
        return "air-handler"
    elif "fancoil" in equipment_id_lower or "fan" in equipment_id_lower:
        return "fancoil"
    elif "geo" in equipment_id_lower:
        return "geo"
    else:
        return "unknown"

def format_alert_subject(alert: Dict) -> str:
    """Format email subject for alerts"""
    severity = alert["severity"]
    alert_type = alert["type"].replace("_", " ").title()
    equipment_location = alert.get("equipment_id", alert.get("location_id", "System"))
    
    return f"[{severity}] {alert_type} - {equipment_location} - Automata Controls BMS"

def format_alert_email_html(alert: Dict) -> str:
    """Format HTML email content for alerts"""
    severity_color = "#dc3545" if alert["severity"] == "CRITICAL" else "#fd7e14"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alert Notification</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: {severity_color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">{alert['severity']} Alert</h1>
            <p style="margin: 5px 0 0 0; font-size: 16px;">{alert['type'].replace('_', ' ').title()}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; border-top: none;">
            <h2 style="color: {severity_color}; margin-top: 0;">Alert Details</h2>
            <p style="font-size: 16px; margin: 15px 0;"><strong>Message:</strong> {alert['message']}</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    """
    
    # Add equipment/location info
    if "equipment_id" in alert:
        html += f"""
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 8px; font-weight: bold; width: 30%;">Equipment ID:</td>
                    <td style="padding: 8px;">{alert['equipment_id']}</td>
                </tr>
        """
    if "location_id" in alert:
        html += f"""
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 8px; font-weight: bold; width: 30%;">Location ID:</td>
                    <td style="padding: 8px;">{alert['location_id']}</td>
                </tr>
        """
    if "equipment_type" in alert:
        html += f"""
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 8px; font-weight: bold; width: 30%;">Equipment Type:</td>
                    <td style="padding: 8px;">{alert['equipment_type'].title()}</td>
                </tr>
        """
    
    html += f"""
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 8px; font-weight: bold; width: 30%;">Timestamp:</td>
                    <td style="padding: 8px;">{alert['timestamp']}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dee2e6;">
                    <td style="padding: 8px; font-weight: bold; width: 30%;">Source:</td>
                    <td style="padding: 8px;">{alert['source'].replace('_', ' ').title()}</td>
                </tr>
            </table>
        </div>
        
        <div style="background: #e9ecef; padding: 15px; border-radius: 0 0 8px 8px; text-align: center;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">
                Automata Controls Nexus BMS<br>
                Enterprise Building Management System
            </p>
        </div>
    </body>
    </html>
    """
    
    return html

def format_alert_email_text(alert: Dict) -> str:
    """Format plain text email content for alerts"""
    text = f"""
AUTOMATA CONTROLS BMS - {alert['severity']} ALERT

Alert Type: {alert['type'].replace('_', ' ').title()}
Message: {alert['message']}

DETAILS:
"""
    
    if "equipment_id" in alert:
        text += f"Equipment ID: {alert['equipment_id']}\n"
    if "location_id" in alert:
        text += f"Location ID: {alert['location_id']}\n"
    if "equipment_type" in alert:
        text += f"Equipment Type: {alert['equipment_type'].title()}\n"
    
    text += f"""Timestamp: {alert['timestamp']}
Source: {alert['source'].replace('_', ' ').title()}

---
Automata Controls Nexus BMS
Enterprise Building Management System
"""
    
    return text

def create_line_protocol(measurement: str, tags: Dict, fields: Dict, timestamp: int) -> object:
    """Create InfluxDB line protocol object"""
    class LineProtocolBuilder:
        def __init__(self, measurement_name):
            self.measurement_name = measurement_name
            self.tags_dict = {}
            self.fields_dict = {}
            self.timestamp_ns = None
        
        def tag(self, key, value):
            self.tags_dict[key] = str(value)
            return self
        
        def field(self, key, value):
            if isinstance(value, str):
                self.fields_dict[key] = f'"{value}"'
            else:
                self.fields_dict[key] = str(value)
            return self
        
        def timestamp(self, ts):
            self.timestamp_ns = ts
            return self
        
        def build(self):
            line = self.measurement_name
            
            if self.tags_dict:
                tag_str = ",".join([f"{k}={v}" for k, v in self.tags_dict.items()])
                line += f",{tag_str}"
            
            if self.fields_dict:
                field_str = ",".join([f"{k}={v}" for k, v in self.fields_dict.items()])
                line += f" {field_str}"
            
            if self.timestamp_ns:
                line += f" {self.timestamp_ns}"
            
            return line
    
    builder = LineProtocolBuilder(measurement)
    
    for key, value in tags.items():
        builder.tag(key, value)
    
    for key, value in fields.items():
        builder.field(key, value)
    
    builder.timestamp(timestamp)
    
    return builder
