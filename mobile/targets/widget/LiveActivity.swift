import ActivityKit
import SwiftUI
import WidgetKit

struct DARTRideLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: DARTRideAttributes.self) { context in
      UberLockRide(state: context.state)
        .activityBackgroundTint(Color.black)
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text("DART")
              .font(.system(size: 10, weight: .bold))
              .foregroundStyle(Color(red: 96 / 255, green: 165 / 255, blue: 250 / 255))
            Text(context.state.riderName)
              .font(.system(size: 15, weight: .semibold))
              .lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 0) {
            Text(pickupLine(context.state))
              .font(.system(size: 13, weight: .semibold))
              .multilineTextAlignment(.trailing)
            Text("\(context.state.minutes) min")
              .font(.system(size: 11, weight: .medium))
              .foregroundStyle(.secondary)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            UberProgress(progress: context.state.progress, late: context.state.late)
            Text("Heading to \(context.state.stopName)")
              .font(.system(size: 12, weight: .medium))
              .foregroundStyle(.secondary)
              .lineLimit(1)
          }
        }
      } compactLeading: {
        Image(systemName: "bus.fill")
          .foregroundStyle(Color(red: 96 / 255, green: 165 / 255, blue: 250 / 255))
      } compactTrailing: {
        Text(context.state.etaClock)
          .font(.system(size: 12, weight: .bold, design: .rounded))
          .foregroundStyle(context.state.late ? Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255) : .primary)
      } minimal: {
        Image(systemName: "bus.fill")
          .foregroundStyle(Color(red: 96 / 255, green: 165 / 255, blue: 250 / 255))
      }
      .widgetURL(URL(string: "dart://track"))
    }
  }
}

private func pickupLine(_ state: DARTRideAttributes.ContentState) -> String {
  let clock = state.etaClock.trimmingCharacters(in: .whitespaces)
  let period = state.etaPeriod.trimmingCharacters(in: .whitespaces)
  if clock.isEmpty || clock == "—" { return "Pickup soon" }
  return "Pickup at \(clock)\(period.isEmpty ? "" : " \(period)")"
}

private struct UberLockRide: View {
  var state: DARTRideAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(pickupLine(state))
        .font(.system(size: 20, weight: .semibold))
        .foregroundStyle(.white)
      Text("Heading to \(state.stopName)")
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(Color.white.opacity(0.62))
        .lineLimit(1)

      UberProgress(progress: state.progress, late: state.late)
        .padding(.top, 2)

      HStack {
        Text(state.riderName)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color.white.opacity(0.55))
        Text("·")
          .foregroundStyle(Color.white.opacity(0.28))
        Text(state.routeCode)
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(Color.white.opacity(0.55))
        Spacer()
        Text(state.late ? state.delayLabel : "On time")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(
            state.late
              ? Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255)
              : Color(red: 110 / 255, green: 231 / 255, blue: 183 / 255)
          )
      }
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 16)
  }
}

private struct UberProgress: View {
  var progress: Double
  var late: Bool

  var body: some View {
    GeometryReader { geo in
      let t = min(0.92, max(0.04, progress))
      let x = geo.size.width * t
      let accent = late
        ? Color(red: 251 / 255, green: 191 / 255, blue: 36 / 255)
        : Color.white
      ZStack(alignment: .leading) {
        Capsule()
          .fill(Color.white.opacity(0.18))
          .frame(height: 3)
        Capsule()
          .fill(accent)
          .frame(width: max(10, x), height: 3)
        Image(systemName: "bus.fill")
          .font(.system(size: 12, weight: .bold))
          .foregroundStyle(.black)
          .padding(5)
          .background(Circle().fill(accent))
          .offset(x: max(0, x - 11), y: 0)
        Circle()
          .fill(Color.white)
          .frame(width: 8, height: 8)
          .offset(x: geo.size.width - 8, y: 0)
      }
    }
    .frame(height: 22)
  }
}
