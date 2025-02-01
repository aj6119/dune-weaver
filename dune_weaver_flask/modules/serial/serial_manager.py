import serial
import serial.tools.list_ports
import threading
import time
import logging
from dune_weaver_flask.modules.core.state import state

logger = logging.getLogger(__name__)

# Global variables
ser = None
ser_port = None
serial_lock = threading.RLock()
IGNORE_PORTS = ['/dev/cu.debug-console', '/dev/cu.Bluetooth-Incoming-Port']

# Device information
arduino_table_name = None
arduino_driver_type = 'Unknown'
firmware_version = 'Unknown'


def list_serial_ports():
    """Return a list of available serial ports."""
    ports = serial.tools.list_ports.comports()
    available_ports = [port.device for port in ports if port.device not in IGNORE_PORTS]
    logger.debug(f"Available serial ports: {available_ports}")
    return available_ports


def startup_gcodes():
    while True:
        with serial_lock:
            ser.write("Report/Status=2".encode())
            ser.flush()
            while ser.in_waiting > 0:
                response = ser.readline().decode().strip()
                logger.debug(f"Response: {response}")
                if "Report" in response:
                    logger.info(response)
                    return
        time.sleep(1)


def connect_to_serial(port=None, baudrate=115200):
    """Automatically connect to the first available serial port or a specified port."""
    global ser, ser_port, arduino_table_name, arduino_driver_type, firmware_version
    try:
        if port is None:
            ports = list_serial_ports()
            if not ports:
                logger.warning("No serial port connected")
                return False
            port = ports[0]  # Auto-select the first available port

        with serial_lock:
            if ser and ser.is_open:
                ser.close()
            ser = serial.Serial(port, baudrate, timeout=2)
            ser_port = port
        # startup_gcodes()
        machine_x, machine_y = get_machine_position()
        if not machine_x or not machine_y or machine_x != state.machine_x or machine_y != state.machine_y:
            logger.info(f'x, y; {machine_x}, {machine_y}')
            logger.info(f'State x, y; {state.machine_x}, {state.machine_y}')
            home()
        else:
            logger.info('Machine position known, skipping home')
        
        logger.info(f"Connected to serial port: {port}")
        time.sleep(2)  # Allow time for the connection to establish

        # Read initial startup messages from Arduino
        while ser.in_waiting > 0:
            line = ser.readline().decode().strip()
            logger.debug(f"Arduino: {line}")
            if "Table:" in line:
                arduino_table_name = line.replace("Table: ", "").strip()
            elif "Drivers:" in line:
                arduino_driver_type = line.replace("Drivers: ", "").strip()
            elif "Version:" in line:
                firmware_version = line.replace("Version: ", "").strip()

        logger.info(f"Detected Table: {arduino_table_name or 'Unknown'}")
        logger.info(f"Detected Drivers: {arduino_driver_type or 'Unknown'}")
        return True
    except serial.SerialException as e:
        logger.error(f"Failed to connect to serial port {port}: {e}")
        ser_port = None

    logger.error("Max retries reached. Could not connect to a serial port.")
    return False


def disconnect_serial():
    """Disconnect the current serial connection."""
    global ser, ser_port
    if ser and ser.is_open:
        logger.info("Disconnecting serial connection")
        ser.close()
        ser = None
    ser_port = None


def restart_serial(port, baudrate=115200):
    """Restart the serial connection."""
    logger.info(f"Restarting serial connection on port {port}")
    disconnect_serial()
    return connect_to_serial(port, baudrate)


def is_connected():
    """Check if serial connection is established and open."""
    return ser is not None and ser.is_open


def get_port():
    """Get the current serial port."""
    return ser_port


def get_status_response():
    """
    Send a status query ('?') and return the response string if available.
    This helper centralizes the query logic used throughout the module.
    """
    while True:
        with serial_lock:
            ser.write('?'.encode())
            ser.flush()
            while ser.in_waiting > 0:
                response = ser.readline().decode().strip()
                if "WPos" in response:
                    logger.info(f"Status response: {response}")
                    return response
        time.sleep(1)



def parse_machine_position(response):
    """
    Parse the work position (WPos) from a status response.
    Expected format: "<...|WPos:-994.869,-321.861,0.000|...>"
    Returns a tuple (work_x, work_y) if found, else None.
    """
    if "WPos:" not in response:
        return None
    try:
        wpos_section = next((part for part in response.split("|") if part.startswith("WPos:")), None)
        if wpos_section:
            wpos_str = wpos_section.split(":", 1)[1]
            wpos_values = wpos_str.split(",")
            work_x = float(wpos_values[0])
            work_y = float(wpos_values[1])
            return work_x, work_y
    except Exception as e:
        logger.error(f"Error parsing work position: {e}")
    return None


def parse_buffer_info(response):
    """
    Parse the planner and serial buffer info from a status response.
    Expected format: "<...|Bf:15,128|...>"
    Returns a dictionary with keys 'planner_buffer' and 'serial_buffer' if found, else None.
    """
    if "|Bf:" in response:
        try:
            buffer_section = response.split("|Bf:")[1].split("|")[0]
            planner_buffer, serial_buffer = map(int, buffer_section.split(","))
            return {"planner_buffer": planner_buffer, "serial_buffer": serial_buffer}
        except ValueError:
            logger.warning("Failed to parse buffer info from response")
    return None


def send_grbl_coordinates(x, y, speed=600, timeout=2, retry_interval=1):
    """
    Send a G-code command to FluidNC and wait up to timeout seconds for an 'ok' response.
    If no 'ok' is received, retry every retry_interval seconds until successful.
    """
    logger.debug(f"Sending G-code: X{x} Y{y} at F{speed}")
    while True:
        with serial_lock:
            gcode = f"G1 G21 X{x} Y{y} F{speed}"
            ser.write(f"{gcode}\n".encode())
            ser.flush()
            logger.debug(f"Sent command: {gcode}")

            start_time = time.time()
            while time.time() - start_time < timeout:
                if ser.in_waiting > 0:
                    response = ser.readline().decode().strip()
                    logger.debug(f"Response: {response}")
                    if response.lower() == "ok":
                        logger.debug("Command execution confirmed.")
                        return  # Exit function when 'ok' is received

            logger.warning(f"No 'ok' received for X{x} Y{y}. Retrying in {retry_interval}s...")

        time.sleep(retry_interval)


def home():
    logger.info(f"Homing with speed {state.speed}")
    send_grbl_coordinates(0, -110/5, state.speed)
    state.current_theta = state.current_rho = 0
    update_machine_position()


def check_idle():
    """
    Continuously check if the machine is in the 'Idle' state.
    """
    logger.info("Checking idle")
    while True:
        response = get_status_response()
        if response and "Idle" in response:
            logger.info("Table is idle")
            update_machine_position()
            return True  # Exit once 'Idle' is confirmed
        time.sleep(1)
        
def get_machine_position():
    response = get_status_response()
    logger.debug(response)
    if response:
        pos = parse_machine_position(response)
        if pos:
            machine_x, machine_y = pos
            logger.debug(f"Machine position: X={machine_x}, Y={machine_y}")
            return machine_x, machine_y
    return None, None

def update_machine_position():
    state.machine_x, state.machine_y = get_machine_position()
    state.save()
