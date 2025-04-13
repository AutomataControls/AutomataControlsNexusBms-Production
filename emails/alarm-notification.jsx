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
} from "@react-email/components"

// Define the props interface
interface AlarmNotificationProps {
  alarmType?: string;
  severity?: string;
  details?: string;
  locationName?: string;
  equipmentName?: string;
  timestamp?: string;
  assignedTechs?: string;
  dashboardUrl?: string;
  alarmId?: string;
  locationId?: string;
}

export const AlarmNotification = ({
  alarmType = "Temperature Threshold Exceeded",
  severity = "warning",
  details = "Temperature value of 80°F exceeds maximum threshold of 75°F",
  locationName = "Main Building",
  equipmentName = "AHU-1",
  timestamp = new Date().toLocaleString(),
  assignedTechs = "John Doe",
  dashboardUrl = "https://neuralbms.automatacontrols.com/dashboard/alarms",
  alarmId = "test-alarm-123",
  locationId,
}: AlarmNotificationProps) => {
  // Get the base URL from environment variables
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://neuralbms.automatacontrols.com';
  
  // Ensure the base URL has a protocol
  const fullBaseUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  
  // Construct the logo URL
  const logoUrl = `${fullBaseUrl}/neural-loader.png`;
  
  // Log the URL for debugging
  console.log(`Using logo URL: ${logoUrl}`);
  console.log(`Using location name: ${locationName}`);
  console.log(`Using equipment name: ${equipmentName}`);
  
  // Set colors based on severity
  const severityColors = {
    critical: '#FF4136',
    warning: '#FF851B',
    info: '#0074D9',
  };
  
  const severityColor = severityColors[severity] || severityColors.warning;
  
  // Create preview text
  const previewText = `ALERT: ${severity.toUpperCase()} - ${alarmType} at ${locationName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      
      <Body style={main}>
        <Container style={container}>
          {/* Logo Header */}
          <Section style={{ textAlign: 'center', marginTop: '20px' }}>
            <Img
              src={logoUrl}
              width="120"
              height="120"
              alt="Automata Controls Logo"
              style={{ margin: '0 auto' }}
            />
          </Section>
          
          {/* Alarm Header */}
          <Section style={{ textAlign: 'center', marginTop: '20px' }}>
            <Text style={{
              ...heading,
              color: severityColor,
              fontSize: '24px',
              letterSpacing: '0.5px',
            }}>
              {severity.toUpperCase()} ALARM
            </Text>
          </Section>
          
          {/* Alarm Type */}
          <Section style={{ marginTop: '20px' }}>
            <Text style={heading}>{alarmType}</Text>
          </Section>
          
          {/* Alarm Details */}
          <Section style={{ marginTop: '10px' }}>
            <Text style={paragraph}>{details}</Text>
          </Section>
          
          {/* Location and Equipment Info */}
          <Section style={{ marginTop: '20px' }}>
            <Row>
              <Column>
                <Text style={labelText}>Location:</Text>
                <Text style={{ ...valueText, color: '#00FFEA', fontWeight: '700' }}>
                  {locationName || `Location ${locationId || "Unknown"}`}
                </Text>
              </Column>
              <Column>
                <Text style={labelText}>Equipment:</Text>
                <Text style={valueText}>{equipmentName || "Unknown Equipment"}</Text>
              </Column>
            </Row>
            <Row style={{ marginTop: '10px' }}>
              <Column>
                <Text style={labelText}>Time:</Text>
                <Text style={valueText}>{timestamp}</Text>
              </Column>
              <Column>
                <Text style={labelText}>Assigned to:</Text>
                <Text style={valueText}>{assignedTechs}</Text>
              </Column>
            </Row>
          </Section>
          
          {/* Action Button */}
          <Section style={{ marginTop: '30px', textAlign: 'center' }}>
            <Button style={{
              ...button,
              backgroundColor: '#0070f3',
            }} href={dashboardUrl}>
              View in Dashboard
            </Button>
          </Section>
          
          <Hr style={hr} />
          
          {/* Footer */}
          <Section style={{ backgroundColor: '#1f2937', padding: '15px', borderRadius: '4px', marginTop: '20px' }}>
            <Row>
              <Column style={{ textAlign: 'center' }}>
                <Link href="https://automatacontrols.com" style={{ color: '#fcd34d', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }}>
                  © AutomataControls
                </Link>
              </Column>
              <Column style={{ textAlign: 'center' }}>
                <Link href="https://gitlab.com/automata-ui/neuralbms" style={{ color: '#99f6e4', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                  GitLab
                </Link>
              </Column>
              <Column style={{ textAlign: 'center' }}>
                <Link href="https://github.com/AutomataControls" style={{ color: '#99f6e4', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                  GitHub
                </Link>
              </Column>
            </Row>
          </Section>
          
          <Section style={{ marginTop: '20px' }}>
            <Text style={footer}>
              This is an automated message from the Automata Controls monitoring system. Alarm ID: {alarmId}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default AlarmNotification

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
}

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  width: "580px",
  maxWidth: "100%",
  backgroundColor: "#ffffff",
  borderRadius: "5px",
  boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
}

const heading = {
  fontSize: "20px",
  lineHeight: "1.3",
  fontWeight: "700",
  color: "#333",
  margin: "0",
  padding: "0 20px",
}

const paragraph = {
  fontSize: "16px",
  lineHeight: "1.4",
  color: "#404040",
  margin: "10px 0",
  padding: "0 20px",
}

const labelText = {
  fontSize: "14px",
  color: "#666",
  margin: "0",
  padding: "0 20px",
}

const valueText = {
  fontSize: "16px",
  color: "#333",
  fontWeight: "500",
  margin: "5px 0 15px",
  padding: "0 20px",
}

const button = {
  backgroundColor: "#0070f3",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  padding: "12px 20px",
  textDecoration: "none",
  textAlign: "center",
  display: "inline-block",
}

const hr = {
  borderColor: "#e1e1e1",
  margin: "20px 0",
}

const footer = {
  color: "#666",
  fontSize: "12px",
  textAlign: "center",
  margin: "0",
  padding: "0 20px",
}
