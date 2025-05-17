import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
  Column,
} from "@react-email/components";

// Define the props interface
interface AlarmNotificationProps {
  alarmType: string;
  severity: string;
  details: string;
  locationName: string;
  locationId: string;
  equipmentName: string;
  timestamp: string;
  assignedTechs?: string;
  dashboardUrl: string;
  alarmId: string;
  isTechnician?: boolean; // New prop to determine if recipient is a technician
}

export const AlarmNotification = ({
  alarmType,
  severity,
  details,
  locationName,
  locationId,
  equipmentName,
  timestamp,
  assignedTechs,
  dashboardUrl,
  alarmId,
  isTechnician = false, // Default to false if not provided
}: AlarmNotificationProps) => {
  // Determine color based on severity
  const severityColor = getSeverityColor(severity);
  const logoUrl = "https://neuralbms.automatacontrols.com/neural-loader.png";

  // Determine if we should show the dashboard button
  const showDashboardButton = isTechnician;

  // Get current year for footer
  const currentYear = new Date().getFullYear();

  return (
    <Html>
      <Head />
      <Preview>{`${severity.toUpperCase()} ALARM: ${alarmType} at ${locationName}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={{ textAlign: "center", marginBottom: "20px" }}>
            <Img
              src={logoUrl}
              width="120"
              height="120"
              alt="NeuralBMS Logo"
              style={{ margin: "0 auto" }}
            />
          </Section>

          {/* Alarm Type Header */}
          <Section style={{ textAlign: "center" }}>
            <Text
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                color: severityColor,
                margin: "10px 0",
              }}
            >
              {severity.toUpperCase()} ALARM
            </Text>
          </Section>

          {/* Alarm Details */}
          <Section style={{ marginTop: "20px" }}>
            <Text
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "10px",
              }}
            >
              {alarmType}
            </Text>
            <Text style={{ fontSize: "16px", lineHeight: "1.5", color: "#333" }}>
              {details}
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Location and Equipment Information */}
          <Section style={{ marginTop: "15px" }}>
            <Row>
              <Column>
                <Text style={labelStyle}>Location:</Text>
                <Text style={valueStyle}>{locationName}</Text>
              </Column>
              <Column>
                <Text style={labelStyle}>Equipment:</Text>
                <Text style={valueStyle}>{equipmentName}</Text>
              </Column>
            </Row>
          </Section>

          {/* Time and Assignment Information */}
          <Section style={{ marginTop: "15px" }}>
            <Row>
              <Column>
                <Text style={labelStyle}>Time:</Text>
                <Text style={valueStyle}>{timestamp}</Text>
              </Column>
              <Column>
                <Text style={labelStyle}>Assigned to:</Text>
                <Text style={valueStyle}>{assignedTechs || "Unassigned"}</Text>
              </Column>
            </Row>
          </Section>

          {/* Dashboard Button - Only shown to technicians */}
          {showDashboardButton && (
            <Section style={{ textAlign: "center", marginTop: "30px" }}>
              <Button
                href={dashboardUrl}
                style={{
                  backgroundColor: "#0070f3",
                  color: "white",
                  padding: "12px 20px",
                  textDecoration: "none",
                  borderRadius: "5px",
                  fontWeight: "bold",
                }}
              >
                View in Dashboard
              </Button>
            </Section>
          )}

          {/* Stylish Footer with NeuralBMS gradients - right to left direction */}
          <Section style={{ backgroundColor: '#1f2937', padding: '24px 15px', borderRadius: '4px', marginTop: '35px' }}>
            {/* Brand Name with teal gradient (RIGHT TO LEFT: light to ultra-light) */}
            <Row>
              <Column style={{ textAlign: 'center' }}>
                <Text style={{ 
                  fontSize: '18px', 
                  fontWeight: '700', 
                  letterSpacing: '0.05em',
                  margin: '0 0 10px 0'
                }}>
                  <span style={{ color: '#14b8a6' }}>NEURAL</span>
                  <span style={{ color: '#5eead4' }}>BMS</span>
                </Text>
              </Column>
            </Row>
            
            {/* Divider */}
            <Hr style={{ 
              borderColor: '#374151', 
              borderWidth: '1px', 
              width: '80%', 
              margin: '10px auto' 
            }} />
            
            {/* Footer details */}
            <Row style={{ marginTop: '10px' }}>
              <Column style={{ textAlign: 'center' }}>
                <Text style={{ 
                  color: '#fcd34d', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  margin: '0' 
                }}>
                  © {currentYear} AutomataControls
                </Text>
              </Column>
            </Row>
            <Row style={{ marginTop: '5px' }}>
              <Column style={{ textAlign: 'center' }}>
                {/* Orange gradient (RIGHT TO LEFT: bright to ultra-light) */}
                <Text style={{ 
                  fontSize: '13px', 
                  fontWeight: '400', 
                  margin: '0',
                  color: '#fb923c'
                }}>
                  <span style={{ color: '#f97316' }}>Building</span>
                  <span style={{ color: '#fb923c' }}>Management</span>
                  <span style={{ color: '#fed7aa' }}>System</span>
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Alarm ID and Footer */}
          <Section style={{ marginTop: "15px", textAlign: "center" }}>
            <Text style={{ fontSize: "12px", color: "#666", margin: "5px 0" }}>
              This is an automated message from the Automata Controls monitoring system.
              Alarm ID: {alarmId}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Helper function to get color based on severity
function getSeverityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "#ef4444"; // Red
    case "warning":
      return "#f59e0b"; // Orange/Amber
    case "info":
      return "#3b82f6"; // Blue
    default:
      return "#6b7280"; // Gray
  }
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
  padding: "20px 0",
};

const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e6e6e6",
  borderRadius: "5px",
  margin: "0 auto",
  padding: "30px",
  maxWidth: "600px",
};

const hr = {
  borderColor: "#e6e6e6",
  margin: "20px 0",
};

const labelStyle = {
  fontSize: "14px",
  color: "#6b7280",
  marginBottom: "5px",
  fontWeight: "500",
};

const valueStyle = {
  fontSize: "16px",
  color: "#111827",
  marginTop: "0",
  fontWeight: "600",
};

export default AlarmNotification;
