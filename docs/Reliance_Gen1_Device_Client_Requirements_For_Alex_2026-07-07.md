# Reliance Gen-1 Device Client Requirements for Alex Tomic

Date: July 7, 2026

Prepared for: Alex Tomic, X-Professionals

Prepared by: Cesar Olivera, Reliance

Purpose: Client-provided operation flow and operation modes for the Reliance Gen-1 headset/device work.

Suggested email subject: Reliance Gen-1 Device Requirements - Operation Flow and Modes

## 1. What Reliance Is

Reliance is a proof-of-service platform for local service businesses.

The goal is to help customers see verified proof of completed service work before and after choosing a provider. Reliance is not primarily a marketplace, payment platform, or scheduling app. The platform is built around service proof, transparency, staged videos, reviews, and a Trust Score.

Reliance supports many service categories, including electricians, cleaning services, car wash/detailing, barber and beauty services, lawn care, repair services, and other local service businesses.

The core Reliance workflow is:

1. A vendor creates or receives a service work record.
2. The vendor assigns the work to an employee.
3. The employee records three short stage videos: Starting Condition, Work in Progress, and Final Result.
4. The employee previews and saves each stage video.
5. The employee submits the completed package to the manager.
6. The manager reviews the package.
7. Reliance admin moderation approves or rejects the proof package.
8. The customer receives access to the approved service video proof.
9. The customer may leave a review.
10. Approved proof, reviews, and operational signals support the vendor profile and Trust Score.

The headset/device is intended to make employee recording easier and more hands-free. It should integrate into this existing proof-of-service workflow.

## 2. Current Gen-1 Direction

The current product direction is phone-first.

The phone is the primary recording and upload platform. The employee opens a secure Reliance service order link on the phone, records the three stage videos, previews each video, confirms the saved clips, and submits the package.

The Gen-1 headset/device should be treated as a phone-paired accessory, not a standalone cloud device.

Current Gen-1 assumptions:

- The phone is the authenticated Reliance client.
- The phone receives the service order and stage instructions.
- The headset pairs with the phone by Bluetooth/BLE.
- The phone sends the active job/stage context to the headset.
- The headset records or assists recording.
- The headset sends media, commands, and telemetry back to the phone.
- The phone uploads media through the Reliance backend and Azure storage.
- The headset should not store customer data.
- The headset should not hold long-lived Reliance backend or Azure storage credentials.

For Gen-1, the server communication should be handled by the phone application and the Reliance backend on Azure. The headset only needs the phone/BLE interface and the media-transfer method Alex recommends.

## 3. Device Operation Flow

This is the required Gen-1 operation flow for the headset/device.

### 3.1 Device Boots Up

When the device powers on:

- The device initializes firmware.
- The device checks battery level.
- The device checks camera/audio readiness if those components are included.
- The device checks whether it has a known paired phone.
- The device enters Pairing Mode if no paired phone is available.
- The device enters Ready/Connected Mode if a known phone reconnects.

Preferred user feedback:

- Use simple audio prompts similar to Shokz-style headset behavior.
- Example prompts:
  - "Power on."
  - "Pairing."
  - "Connected."
  - "Battery high."
  - "Battery medium."
  - "Battery low."

LED feedback should be secondary and simple. The worker should not need to memorize many LED patterns.

### 3.2 User Pairs Device With Phone

The employee pairs the headset/device with the phone.

Expected behavior:

- The phone shows an available Reliance device.
- The employee selects the device.
- The device and phone complete BLE pairing.
- The phone links the device to the employee session.
- The phone confirms the device is available for the current work record.

The phone remains responsible for user identity and work record permissions.

### 3.3 Phone Sends Active Job Configuration to Device

After pairing, the phone sends the device the current service order context.

The device does not need the full customer profile. The device only needs the minimum active capture context.

Recommended configuration payload:

- Work record ID.
- Media session ID.
- Current stage:
  - Starting Condition.
  - Work in Progress.
  - Final Result.
- Stage order.
- Maximum clip duration, currently 30 seconds per stage.
- Whether recording is allowed.
- Whether location/consent checks passed on the phone.
- Device time sync value.

### 3.4 Device Enters Ready Mode

Ready Mode means:

- The device is connected to the phone.
- The phone has an active service order.
- The phone has selected the current stage.
- Recording is permitted.
- The device is waiting for a record command.

The record command may come from:

- A button on the headset/device.
- A button in the phone interface.
- A future app command.

### 3.5 Employee Starts Recording

When recording starts:

- The phone and headset agree which stage is being recorded.
- The 30-second stage timer starts.
- The device records the clip or assists the phone recording, depending on the final hardware design.
- The phone should continue showing the stage, countdown, and recording state.

Preferred user feedback:

- Audio prompt: "Recording started."
- Simple recording indicator on the device.

### 3.6 Employee Stops Recording

Recording stops when:

- The employee taps stop.
- The employee presses a device button.
- The 30-second limit is reached.
- The phone cancels recording.
- The device reports a hardware or battery issue.

Preferred user feedback:

- Audio prompt: "Recording stopped."

### 3.7 Preview, Confirm, or Retake

After each clip:

- The phone shows a full-screen preview.
- The employee can confirm and save.
- The employee can retake the stage.
- A saved stage can be edited/retaken before the full package is submitted.

This preview and retake flow should remain phone-controlled, even if the media was captured by the headset.

### 3.8 Transfer and Upload

After the employee confirms a stage:

- The headset sends the captured media to the phone, if the headset captured the media.
- The phone creates or updates the Reliance media session.
- The phone uploads the stage video through the Reliance backend and Azure storage.
- The backend validates the upload and attaches it to the correct work record and stage.

The headset should report transfer status to the phone, but the phone is responsible for the final upload and server confirmation.

### 3.9 Package Submission

After all three stage videos are confirmed:

- The employee taps Send Videos to Manager.
- The package moves to manager review.
- The manager can approve or reject the package.
- If approved by the manager, the package moves to Reliance admin moderation.
- If approved by admin, the customer can receive the service video proof.

### 3.10 Customer Proof, Review, and Trust Score

After approval:

- The customer receives access to the approved service videos.
- The customer can watch the proof.
- The customer can leave a review.
- Reviews may require admin moderation.
- Approved proof and review activity can affect vendor profile metrics and Trust Score according to Reliance rules.

## 4. Device Operation Modes

Recommended Gen-1 device modes:

| Mode | Meaning | Exit Condition |
| --- | --- | --- |
| Off | Device is powered down. | User powers on device. |
| Booting | Firmware initializes battery, BLE, audio/camera components. | Boot succeeds or error occurs. |
| Pairing | Device is discoverable to phone. | Phone pairs or pairing times out. |
| Connected | Device is paired and connected to phone. | Phone sends active job context or disconnect occurs. |
| Ready | Device has active job/stage context and can record. | Record command, cancel command, or disconnect. |
| Recording | Device/phone is capturing a stage video. | Stop, timeout, cancel, or error. |
| Transfer Pending | Captured media is waiting to transfer to phone. | Transfer starts or retry begins. |
| Transferring | Media is moving from device to phone. | Transfer completes or fails. |
| Transfer Complete | Phone has received the clip. | Phone moves to preview/upload. |
| Transfer Failed | Clip did not transfer correctly. | Retry, retake, or cancel. |
| Upload Pending | Phone has clip and is preparing upload. | Phone uploads through Reliance backend and Azure storage. |
| Upload Confirmed | Backend confirmed uploaded media for the stage. | Phone marks stage saved. |
| Low Battery | Battery is below operating threshold. | Charge device or continue with warning if allowed. |
| Firmware Update | Device firmware update is in progress. | Update completes or fails. |
| Error | Device cannot continue normal operation. | Reset, reconnect, or support action. |

## 5. User Feedback Requirements

Reliance should not depend on employees memorizing many LED colors, blink patterns, or buzzer sequences.

Preferred feedback model:

- Use simple headset audio prompts where possible.
- Use a minimal LED only as a backup status indicator.
- Use the phone screen as the main source of detailed instructions.

Recommended audio prompts:

- "Power on."
- "Pairing."
- "Connected."
- "Battery high."
- "Battery medium."
- "Battery low."
- "Recording started."
- "Recording stopped."
- "Transfer complete."
- "Transfer failed."
- "Disconnected."
- "Reconnecting."

Recommended LED behavior:

- One clear pairing/connection indicator.
- One clear recording indicator.
- One clear low battery or error indicator.

If a buzzer is included, it should be used only as a simple confirmation/error alert. It should not be the primary way a worker understands the device state.

## 6. Hardware Expectations

The Gen-1 headset/device should support the phone-first Reliance workflow.

Expected hardware areas:

- Bluetooth/BLE communication with phone.
- Camera or capture module if the headset records video.
- Microphone if audio capture is included.
- DSP/audio processor selection appropriate for capture, prompts, and power constraints.
- Battery and charging.
- Physical controls.
- Minimal status LED.
- Optional buzzer only if useful.
- Firmware update capability.

Button expectations:

- Power button.
- Pairing/action button, if not combined with power.
- Record/stop button.
- Optional cancel/back control if hardware space allows.

The record/stop control is the most important service-flow button.

## 7. Firmware Expectations

Firmware should support:

- Boot and hardware self-check.
- BLE pairing.
- Reconnection after phone disconnect.
- Receiving active job/stage configuration from phone.
- Receiving commands from phone.
- Sending button events to phone.
- Starting and stopping recording when allowed.
- Tracking clip duration.
- Sending media or media-ready events to phone.
- Reporting battery level.
- Reporting device health.
- Reporting firmware version.
- Handling transfer retries.
- Handling firmware updates.
- Entering a safe state when errors occur.

Firmware should avoid:

- Storing customer profile data.
- Holding long-lived Reliance backend credentials.
- Requiring direct Azure access.
- Making independent customer/privacy decisions that belong to the phone/backend workflow.

## 8. BLE/App Contract to Define

The following BLE/app contract still needs final definition with Alex:

- Device service UUIDs.
- Command characteristic.
- Status/event characteristic.
- Battery characteristic.
- Firmware/version characteristic.
- Optional media-transfer characteristic or selected transfer path.

Likely command examples:

- Pair/start pairing.
- Set active job context.
- Set active stage.
- Start recording.
- Stop recording.
- Cancel recording.
- Request battery.
- Request device status.
- Start transfer.
- Retry transfer.
- Begin firmware update.

Likely event examples:

- Device ready.
- Paired.
- Connected.
- Disconnected.
- Recording started.
- Recording stopped.
- Clip ready.
- Transfer progress.
- Transfer complete.
- Transfer failed.
- Battery low.
- Error.

The final media-transfer method is a key Alex decision. BLE may be sufficient for commands and telemetry, but video transfer may require a different approach depending on file size, speed, battery, and hardware constraints.

## 9. Azure and Platform Testing Expectations

Reliance currently uses an Azure-backed backend and storage workflow.

For Gen-1 device testing, Azure/platform work should focus on simulating and validating:

- Device registration.
- Device pairing.
- Device assignment to employee/vendor.
- Active job context sent from phone to device.
- Device event ingestion.
- Recording started/stopped events.
- Transfer status events.
- Upload completion events.
- Retry/error events.
- Battery and firmware telemetry.
- Audit logs for device activity.

The platform should test the same workflow whether media comes from:

- Phone-only recording.
- Future headset-assisted recording.
- Future headset-captured media transferred to the phone.

## 10. PCB and DSP Implications

Based on the current phone-first direction:

- The PCB does not need to support direct cloud networking for Gen-1.
- BLE communication with the phone is essential.
- Media capture and transfer requirements should drive DSP/camera/storage decisions.
- Physical controls should prioritize recording flow and pairing reliability.
- Audio prompts are preferred over complex buzzer/LED behavior.
- Battery behavior and charging should support short on-site service recordings.

Alex should select the DSP/audio processor based on:

- Audio prompt playback.
- Microphone/capture needs.
- Power usage.
- Firmware support.
- BLE/media-transfer architecture.
- Board space and cost.

## 11. Functional Tests on Real PCB

Recommended real-PCB tests:

- Power on/off.
- Pair with phone.
- Reconnect after phone moves away and returns.
- Receive active service order context from phone.
- Start stage recording.
- Stop stage recording.
- Enforce or report 30-second stage duration.
- Transfer media/status to phone.
- Retry transfer after interruption.
- Report low battery.
- Report firmware version.
- Perform firmware update.
- Handle error recovery.
- Confirm phone can upload the resulting stage to Reliance backend and Azure storage.

## 12. Questions for Alex

These are the remaining technical questions that materially affect hardware and firmware work:

1. What media-transfer method does Alex recommend for headset-captured video moving to the phone?
2. Is BLE acceptable only for commands/telemetry, with another path for video transfer?
3. What camera module, image pipeline, and file format are practical for the desired headset form factor?
4. What DSP/audio processor best supports audio prompts, microphone handling, power constraints, and firmware complexity?
5. How many physical buttons can fit without making the headset awkward to use?
6. Should the record/stop button be separate from pairing/power?
7. What minimum local buffer/storage is needed if the phone temporarily disconnects during recording?
8. What battery size and expected runtime are realistic for short stage recordings?
9. What firmware update method does Alex recommend?
10. What level of diagnostic logging can firmware provide without overcomplicating the PCB or firmware?
