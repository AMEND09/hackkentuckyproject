import SwiftUI
import WidgetKit

private let appGroup = "group.com.app.dart"

struct RiderSnapshot {
  var name: String
  var stop: String
  var route: String
  var clock: String
  var period: String
  var delay: String
  var late: Bool
  var secondName: String
  var secondClock: String
  var secondDelay: String

  static func load() -> RiderSnapshot {
    let defaults = UserDefaults(suiteName: appGroup)
    return RiderSnapshot(
      name: defaults?.string(forKey: "name") ?? "Leo",
      stop: defaults?.string(forKey: "stop") ?? "Oakridge Stop 11",
      route: defaults?.string(forKey: "route") ?? "Bus 14",
      clock: defaults?.string(forKey: "clock") ?? "7:38",
      period: defaults?.string(forKey: "period") ?? "AM",
      delay: defaults?.string(forKey: "delay") ?? "+6 min",
      late: (defaults?.integer(forKey: "late") ?? 1) == 1,
      secondName: defaults?.string(forKey: "secondName") ?? "Mia",
      secondClock: defaults?.string(forKey: "secondClock") ?? "7:42",
      secondDelay: defaults?.string(forKey: "secondDelay") ?? "On time"
    )
  }
}

struct DARTEntry: TimelineEntry {
  let date: Date
  let rider: RiderSnapshot
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> DARTEntry {
    DARTEntry(date: Date(), rider: RiderSnapshot.load())
  }

  func getSnapshot(in context: Context, completion: @escaping (DARTEntry) -> Void) {
    completion(DARTEntry(date: Date(), rider: RiderSnapshot.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DARTEntry>) -> Void) {
    let entry = DARTEntry(date: Date(), rider: RiderSnapshot.load())
    let next = Date().addingTimeInterval(60)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}

struct DARTRiderWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DARTRiderWidget", provider: Provider()) { entry in
      DARTWidgetView(entry: entry)
        .widgetURL(URL(string: "dart://track"))
    }
    .configurationDisplayName("DART")
    .description("Arrival estimates for your riders.")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
  }
}

struct DARTWidgetView: View {
  @Environment(\.widgetFamily) var family
  var entry: DARTEntry

  var body: some View {
    switch family {
    case .systemMedium:
      MediumView(rider: entry.rider)
        .containerBackground(for: .widget) { Color.white }
    case .accessoryRectangular:
      LockView(rider: entry.rider)
        .containerBackground(for: .widget) { Color.clear }
    default:
      SmallView(rider: entry.rider)
        .containerBackground(for: .widget) { Color.white }
    }
  }
}

private let dartInk = Color(red: 17 / 255, green: 24 / 255, blue: 39 / 255)
private let dartMuted = Color(red: 100 / 255, green: 116 / 255, blue: 139 / 255)
private let dartWarn = Color(red: 217 / 255, green: 119 / 255, blue: 6 / 255)
private let dartSuccess = Color(red: 5 / 255, green: 150 / 255, blue: 105 / 255)

struct BrandRow: View {
  var body: some View {
    HStack(spacing: 6) {
      if let _ = UIImage(named: "DartMark") {
        Image("DartMark").resizable().scaledToFit().frame(width: 14, height: 14)
      } else {
        Image(systemName: "location.north.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255))
      }
      Text("DART")
        .font(.system(size: 11, weight: .bold, design: .rounded))
        .tracking(0.4)
        .foregroundStyle(dartInk)
    }
  }
}

struct SmallView: View {
  var rider: RiderSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      BrandRow()
      Text(rider.clock)
        .font(.system(size: 34, weight: .bold, design: .rounded))
        .tracking(-1)
        .foregroundStyle(dartInk)
        .padding(.top, 10)
      Text(rider.period)
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(dartMuted)
      Spacer(minLength: 8)
      Text(rider.name)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(dartInk)
        .lineLimit(1)
      Text(rider.delay)
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(rider.late ? dartWarn : dartSuccess)
        .padding(.top, 2)
    }
  }
}

struct MediumView: View {
  var rider: RiderSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      BrandRow()
      HStack(alignment: .top, spacing: 16) {
        RiderCol(name: rider.name, stop: rider.stop, route: rider.route, clock: rider.clock, delay: rider.delay, late: rider.late)
        if !rider.secondName.isEmpty {
          RiderCol(
            name: rider.secondName,
            stop: "",
            route: "",
            clock: rider.secondClock,
            delay: rider.secondDelay,
            late: rider.secondDelay.hasPrefix("+")
          )
        }
      }
    }
  }
}

struct RiderCol: View {
  var name: String
  var stop: String
  var route: String
  var clock: String
  var delay: String
  var late: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(clock)
        .font(.system(size: 28, weight: .bold, design: .rounded))
        .tracking(-0.8)
        .foregroundStyle(dartInk)
      Text(name)
        .font(.system(size: 14, weight: .semibold))
        .foregroundStyle(dartInk)
        .lineLimit(1)
      if !stop.isEmpty {
        Text([stop, route].filter { !$0.isEmpty }.joined(separator: " · "))
          .font(.system(size: 12))
          .foregroundStyle(dartMuted)
          .lineLimit(1)
      }
      Text(delay)
        .font(.system(size: 12, weight: .bold))
        .foregroundStyle(late ? dartWarn : dartSuccess)
        .padding(.top, 2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct LockView: View {
  var rider: RiderSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack(spacing: 6) {
        Text("DART")
          .font(.system(size: 11, weight: .bold))
        Text(rider.name)
          .font(.system(size: 11, weight: .medium))
          .foregroundStyle(.secondary)
      }
      Text("\(rider.clock) \(rider.period)")
        .font(.system(size: 16, weight: .semibold, design: .rounded))
      Text("\(rider.delay) · \(rider.stop)")
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
  }
}
