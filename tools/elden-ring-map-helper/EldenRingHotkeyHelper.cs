using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;

internal sealed class HotkeyFailure : Exception
{
    public string Code { get; private set; }

    public HotkeyFailure(string code, string message) : base(message)
    {
        Code = code;
    }
}

internal sealed class HotkeyMacro
{
    public string Id;
    public readonly List<ushort> TriggerKeys = new List<ushort>();
    public readonly List<HotkeyAction> Actions = new List<HotkeyAction>();

    public ushort ActivationKey
    {
        get { return TriggerKeys[TriggerKeys.Count - 1]; }
    }
}

internal sealed class HotkeyAction
{
    public string Type;
    public string Code;
    public InputControl[] Controls;
    public int DurationMs;
}

internal sealed class InputControl
{
    public string Code;
    public ushort VirtualKey;
    public bool Extended;
    public bool IsMouse;
    public uint MouseDownFlag;
    public uint MouseUpFlag;
    public uint MouseData;
}

internal sealed class HotkeyConfig
{
    public readonly List<HotkeyMacro> Macros = new List<HotkeyMacro>();

    public static HotkeyConfig Load(string configPath)
    {
        if (!File.Exists(configPath)) throw new HotkeyFailure("CONFIG_NOT_FOUND", configPath);
        string[] lines = File.ReadAllLines(configPath);
        if (lines.Length == 0 || lines[0].Trim() != "EROVERLY_HOTKEYS_V2")
            throw new HotkeyFailure("CONFIG_VERSION", "Unsupported hotkey configuration.");

        HotkeyConfig config = new HotkeyConfig();
        HashSet<string> ids = new HashSet<string>(StringComparer.Ordinal);
        HashSet<string> triggers = new HashSet<string>(StringComparer.Ordinal);
        int index = 1;
        while (index < lines.Length)
        {
            string line = lines[index].Trim();
            if (line.Length == 0)
            {
                index++;
                continue;
            }
            string[] fields = line.Split('\t');
            if (fields.Length != 3 || fields[0] != "MACRO")
                throw new HotkeyFailure("CONFIG_LINE", "Line " + (index + 1));
            if (fields[1].Length == 0 || !ids.Add(fields[1]))
                throw new HotkeyFailure("CONFIG_ID", fields[1]);

            HotkeyMacro macro = new HotkeyMacro { Id = fields[1] };
            ParseKeys(fields[2], macro.TriggerKeys, "CONFIG_TRIGGER");
            index++;
            HashSet<string> heldKeys = new HashSet<string>(StringComparer.Ordinal);
            long totalDurationMs = 0;
            bool ended = false;
            while (index < lines.Length)
            {
                string actionLine = lines[index].Trim();
                if (actionLine == "END")
                {
                    ended = true;
                    index++;
                    break;
                }
                string[] actionFields = actionLine.Split('\t');
                if (actionFields.Length != 4 || actionFields[0] != "ACTION")
                    throw new HotkeyFailure("CONFIG_ACTION", "Line " + (index + 1));
                HotkeyAction action = ParseAction(actionFields, heldKeys, index + 1);
                macro.Actions.Add(action);
                totalDurationMs += action.DurationMs;
                index++;
            }
            if (!ended) throw new HotkeyFailure("CONFIG_END", fields[1]);
            if (macro.Actions.Count == 0 || macro.Actions.Count > 64)
                throw new HotkeyFailure("CONFIG_ACTION_LIMIT", fields[1]);
            if (heldKeys.Count != 0) throw new HotkeyFailure("CONFIG_ACTION_SEQUENCE", fields[1]);
            if (totalDurationMs > 120000) throw new HotkeyFailure("CONFIG_DURATION", fields[1]);
            string triggerKey = string.Join(",", macro.TriggerKeys.OrderBy(value => value));
            if (!triggers.Add(triggerKey)) throw new HotkeyFailure("CONFIG_TRIGGER_CONFLICT", fields[1]);
            config.Macros.Add(macro);
        }
        if (config.Macros.Count == 0) throw new HotkeyFailure("CONFIG_EMPTY", "No enabled macros were provided.");
        if (config.Macros.Count > 32) throw new HotkeyFailure("CONFIG_LIMIT", config.Macros.Count.ToString(CultureInfo.InvariantCulture));
        return config;
    }

    private static HotkeyAction ParseAction(string[] fields, HashSet<string> heldKeys, int lineNumber)
    {
        string type = fields[1];
        int durationMs;
        if (!int.TryParse(fields[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out durationMs))
            throw new HotkeyFailure("CONFIG_ACTION_DURATION", "Line " + lineNumber);

        if (type == "WAIT")
        {
            if (fields[2] != "-" || durationMs < 1 || durationMs > 60000)
                throw new HotkeyFailure("CONFIG_ACTION_WAIT", "Line " + lineNumber);
            return new HotkeyAction { Type = type, DurationMs = durationMs };
        }

        string code = fields[2];
        InputControl[] controls = KeyMap.ResolveAction(code);
        if (type == "TAP")
        {
            if (heldKeys.Contains(code) || durationMs < 1 || durationMs > 60000)
                throw new HotkeyFailure("CONFIG_ACTION_SEQUENCE", "Line " + lineNumber);
            return new HotkeyAction { Type = type, Code = code, Controls = controls, DurationMs = durationMs };
        }
        if (durationMs != 0) throw new HotkeyFailure("CONFIG_ACTION_DURATION", "Line " + lineNumber);
        if (type == "DOWN")
        {
            if (!heldKeys.Add(code)) throw new HotkeyFailure("CONFIG_ACTION_SEQUENCE", "Line " + lineNumber);
            return new HotkeyAction { Type = type, Code = code, Controls = controls };
        }
        if (type == "UP")
        {
            if (!heldKeys.Remove(code)) throw new HotkeyFailure("CONFIG_ACTION_SEQUENCE", "Line " + lineNumber);
            return new HotkeyAction { Type = type, Code = code, Controls = controls };
        }
        throw new HotkeyFailure("CONFIG_ACTION_TYPE", "Line " + lineNumber);
    }

    private static void ParseKeys(string value, List<ushort> target, string code)
    {
        HashSet<ushort> unique = new HashSet<ushort>();
        foreach (string token in value.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries))
        {
            ushort key = KeyMap.ResolveTrigger(token);
            if (!unique.Add(key)) throw new HotkeyFailure(code, "Duplicate key: " + token);
            target.Add(key);
        }
        if (target.Count == 0 || target.Count > 8) throw new HotkeyFailure(code, value);
    }
}

internal static class KeyMap
{
    private static readonly Dictionary<string, ushort> Keys = BuildKeyboard();
    private static readonly Dictionary<string, InputControl[]> Actions = BuildActions();

    public static ushort ResolveTrigger(string code)
    {
        ushort value;
        if (!Keys.TryGetValue(code, out value)) throw new HotkeyFailure("UNSUPPORTED_KEY", code);
        return value;
    }

    public static InputControl[] ResolveAction(string code)
    {
        InputControl[] value;
        if (!Actions.TryGetValue(code, out value)) throw new HotkeyFailure("UNSUPPORTED_ACTION", code);
        return value;
    }

    private static Dictionary<string, ushort> BuildKeyboard()
    {
        Dictionary<string, ushort> keys = new Dictionary<string, ushort>(StringComparer.Ordinal);
        for (int index = 0; index < 26; index++) keys["Key" + (char)('A' + index)] = (ushort)(0x41 + index);
        for (int index = 0; index < 10; index++)
        {
            keys["Digit" + index] = (ushort)(0x30 + index);
            keys["Numpad" + index] = (ushort)(0x60 + index);
        }
        for (int index = 1; index <= 24; index++) keys["F" + index] = (ushort)(0x6F + index);

        keys["Backspace"] = 0x08;
        keys["Tab"] = 0x09;
        keys["Enter"] = 0x0D;
        keys["ShiftLeft"] = 0xA0;
        keys["ShiftRight"] = 0xA1;
        keys["ControlLeft"] = 0xA2;
        keys["ControlRight"] = 0xA3;
        keys["AltLeft"] = 0xA4;
        keys["AltRight"] = 0xA5;
        keys["Pause"] = 0x13;
        keys["CapsLock"] = 0x14;
        keys["Escape"] = 0x1B;
        keys["Space"] = 0x20;
        keys["PageUp"] = 0x21;
        keys["PageDown"] = 0x22;
        keys["End"] = 0x23;
        keys["Home"] = 0x24;
        keys["ArrowLeft"] = 0x25;
        keys["ArrowUp"] = 0x26;
        keys["ArrowRight"] = 0x27;
        keys["ArrowDown"] = 0x28;
        keys["Insert"] = 0x2D;
        keys["Delete"] = 0x2E;
        keys["NumLock"] = 0x90;
        keys["ScrollLock"] = 0x91;
        keys["NumpadMultiply"] = 0x6A;
        keys["NumpadAdd"] = 0x6B;
        keys["NumpadSubtract"] = 0x6D;
        keys["NumpadDecimal"] = 0x6E;
        keys["NumpadDivide"] = 0x6F;
        keys["Semicolon"] = 0xBA;
        keys["Equal"] = 0xBB;
        keys["Comma"] = 0xBC;
        keys["Minus"] = 0xBD;
        keys["Period"] = 0xBE;
        keys["Slash"] = 0xBF;
        keys["Backquote"] = 0xC0;
        keys["BracketLeft"] = 0xDB;
        keys["Backslash"] = 0xDC;
        keys["BracketRight"] = 0xDD;
        keys["Quote"] = 0xDE;
        return keys;
    }

    private static Dictionary<string, InputControl[]> BuildActions()
    {
        Dictionary<string, InputControl[]> actions = new Dictionary<string, InputControl[]>(StringComparer.Ordinal);
        foreach (KeyValuePair<string, ushort> key in Keys)
        {
            actions[key.Key] = new[] { new InputControl { Code = key.Key, VirtualKey = key.Value, Extended = IsExtendedKey(key.Value) } };
        }
        actions["MouseLeft"] = Mouse("MouseLeft", NativeHotkeys.MOUSEEVENTF_LEFTDOWN, NativeHotkeys.MOUSEEVENTF_LEFTUP, 0);
        actions["MouseRight"] = Mouse("MouseRight", NativeHotkeys.MOUSEEVENTF_RIGHTDOWN, NativeHotkeys.MOUSEEVENTF_RIGHTUP, 0);
        actions["MouseMiddle"] = Mouse("MouseMiddle", NativeHotkeys.MOUSEEVENTF_MIDDLEDOWN, NativeHotkeys.MOUSEEVENTF_MIDDLEUP, 0);
        actions["MouseX1"] = Mouse("MouseX1", NativeHotkeys.MOUSEEVENTF_XDOWN, NativeHotkeys.MOUSEEVENTF_XUP, 1);
        actions["MouseX2"] = Mouse("MouseX2", NativeHotkeys.MOUSEEVENTF_XDOWN, NativeHotkeys.MOUSEEVENTF_XUP, 2);

        actions["GameAttack"] = Combine(actions, "MouseLeft");
        actions["GameStrongAttack"] = Combine(actions, "ShiftLeft", "MouseLeft");
        actions["GameGuard"] = Combine(actions, "MouseRight");
        actions["GameSkill"] = Combine(actions, "ShiftLeft", "MouseRight");
        actions["GameInteract"] = Combine(actions, "KeyE");
        actions["GameSprintDodge"] = Combine(actions, "Space");
        actions["GameJump"] = Combine(actions, "KeyF");
        actions["GameUseItem"] = Combine(actions, "KeyR");
        actions["GameLockOn"] = Combine(actions, "KeyQ");
        actions["GameCrouch"] = Combine(actions, "KeyX");
        actions["GameSwitchSpell"] = Combine(actions, "ArrowUp");
        actions["GameSwitchItem"] = Combine(actions, "ArrowDown");
        actions["GameSwitchRightWeapon"] = Combine(actions, "ArrowRight");
        actions["GameSwitchLeftWeapon"] = Combine(actions, "ArrowLeft");
        actions["GameMoveForward"] = Combine(actions, "KeyW");
        actions["GameMoveBackward"] = Combine(actions, "KeyS");
        actions["GameMoveLeft"] = Combine(actions, "KeyA");
        actions["GameMoveRight"] = Combine(actions, "KeyD");
        return actions;
    }

    private static InputControl[] Mouse(string code, uint down, uint up, uint data)
    {
        return new[] { new InputControl { Code = code, IsMouse = true, MouseDownFlag = down, MouseUpFlag = up, MouseData = data } };
    }

    private static InputControl[] Combine(Dictionary<string, InputControl[]> actions, params string[] codes)
    {
        List<InputControl> controls = new List<InputControl>();
        foreach (string code in codes) controls.AddRange(actions[code]);
        return controls.ToArray();
    }

    private static bool IsExtendedKey(ushort virtualKey)
    {
        return virtualKey == 0xA3 || virtualKey == 0xA5 || virtualKey == 0x6F || virtualKey == 0x90 ||
               (virtualKey >= 0x21 && virtualKey <= 0x28) || virtualKey == 0x2D || virtualKey == 0x2E;
    }
}

internal static class NativeHotkeys
{
    public const int WH_KEYBOARD_LL = 13;
    public const int WM_KEYDOWN = 0x0100;
    public const int WM_KEYUP = 0x0101;
    public const int WM_SYSKEYDOWN = 0x0104;
    public const int WM_SYSKEYUP = 0x0105;
    public const uint WM_QUIT = 0x0012;
    public const uint INPUT_MOUSE = 0;
    public const uint INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_SCANCODE = 0x0008;
    public const uint LLKHF_INJECTED = 0x00000010;
    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
    public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
    public const uint MOUSEEVENTF_XDOWN = 0x0080;
    public const uint MOUSEEVENTF_XUP = 0x0100;

    public delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct KbdLlHookStruct
    {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KeyboardInput
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MouseInput
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion
    {
        [FieldOffset(0)] public KeyboardInput keyboard;
        [FieldOffset(0)] public MouseInput mouse;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct Input
    {
        public uint type;
        public InputUnion data;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct Point
    {
        public int x;
        public int y;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct Message
    {
        public IntPtr hwnd;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public Point point;
        public uint privateValue;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SetWindowsHookEx(int hookId, LowLevelKeyboardProc callback, IntPtr module, uint threadId);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool UnhookWindowsHookEx(IntPtr hook);

    [DllImport("user32.dll")]
    public static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetMessage(out Message message, IntPtr window, uint minFilter, uint maxFilter);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint count, Input[] inputs, int size);

    [DllImport("user32.dll")]
    public static extern uint MapVirtualKey(uint code, uint mapType);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool PostThreadMessage(uint threadId, uint message, UIntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();
}

internal static class EldenRingHotkeyHelper
{
    private static readonly object Sync = new object();
    private static readonly object OutputSync = new object();
    private static readonly HashSet<ushort> PressedKeys = new HashSet<ushort>();
    private static readonly HashSet<ushort> SuppressedKeys = new HashSet<ushort>();
    private static readonly HashSet<string> ActiveMacros = new HashSet<string>(StringComparer.Ordinal);
    private static HotkeyConfig config;
    private static IntPtr hook;
    private static NativeHotkeys.LowLevelKeyboardProc hookCallback;
    private static volatile bool running;
    private static uint messageThreadId;
    private static int pendingMacros;

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length == 2 && args[0] == "--validate")
            {
                HotkeyConfig validation = HotkeyConfig.Load(args[1]);
                WriteState("VALID", validation.Macros.Count.ToString(CultureInfo.InvariantCulture));
                return 0;
            }
            if (args.Length != 3 || args[0] != "--watch")
                throw new HotkeyFailure("ARGUMENTS", "Use --validate <config> or --watch <config> <lease>.");

            config = HotkeyConfig.Load(args[1]);
            string leasePath = args[2];
            if (!File.Exists(leasePath)) throw new HotkeyFailure("LEASE_NOT_FOUND", leasePath);
            if (Process.GetProcessesByName("EasyAntiCheat_EOS").Length > 0)
                throw new HotkeyFailure("ANTI_CHEAT_RUNNING", "Start Elden Ring offline without Easy Anti-Cheat.");

            running = true;
            messageThreadId = NativeHotkeys.GetCurrentThreadId();
            hookCallback = HookProcedure;
            hook = NativeHotkeys.SetWindowsHookEx(NativeHotkeys.WH_KEYBOARD_LL, hookCallback, IntPtr.Zero, 0);
            if (hook == IntPtr.Zero)
                throw new HotkeyFailure("HOOK_INSTALL_FAILED", Marshal.GetLastWin32Error().ToString(CultureInfo.InvariantCulture));

            Thread leaseThread = new Thread(() => MonitorLease(leasePath));
            leaseThread.IsBackground = true;
            leaseThread.Start();
            WriteState("READY", config.Macros.Count.ToString(CultureInfo.InvariantCulture));

            NativeHotkeys.Message message;
            while (running && NativeHotkeys.GetMessage(out message, IntPtr.Zero, 0, 0) > 0) { }
            return 0;
        }
        catch (HotkeyFailure failure)
        {
            WriteState("ERROR", failure.Code + "\t" + Sanitize(failure.Message));
            return 2;
        }
        catch (Exception error)
        {
            WriteState("ERROR", "UNEXPECTED\t" + Sanitize(error.GetType().Name + ": " + error.Message));
            return 3;
        }
        finally
        {
            running = false;
            if (hook != IntPtr.Zero) NativeHotkeys.UnhookWindowsHookEx(hook);
            for (int attempt = 0; attempt < 50 && Interlocked.CompareExchange(ref pendingMacros, 0, 0) > 0; attempt++)
                Thread.Sleep(20);
        }
    }

    private static void MonitorLease(string leasePath)
    {
        while (running)
        {
            try
            {
                if (!File.Exists(leasePath) || DateTime.UtcNow - File.GetLastWriteTimeUtc(leasePath) > TimeSpan.FromSeconds(5))
                {
                    running = false;
                    NativeHotkeys.PostThreadMessage(messageThreadId, NativeHotkeys.WM_QUIT, UIntPtr.Zero, IntPtr.Zero);
                    return;
                }
            }
            catch
            {
                running = false;
                NativeHotkeys.PostThreadMessage(messageThreadId, NativeHotkeys.WM_QUIT, UIntPtr.Zero, IntPtr.Zero);
                return;
            }
            Thread.Sleep(500);
        }
    }

    private static IntPtr HookProcedure(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code < 0) return NativeHotkeys.CallNextHookEx(hook, code, wParam, lParam);
        NativeHotkeys.KbdLlHookStruct data = (NativeHotkeys.KbdLlHookStruct)Marshal.PtrToStructure(lParam, typeof(NativeHotkeys.KbdLlHookStruct));
        if ((data.flags & NativeHotkeys.LLKHF_INJECTED) != 0)
            return NativeHotkeys.CallNextHookEx(hook, code, wParam, lParam);

        int message = wParam.ToInt32();
        bool down = message == NativeHotkeys.WM_KEYDOWN || message == NativeHotkeys.WM_SYSKEYDOWN;
        bool up = message == NativeHotkeys.WM_KEYUP || message == NativeHotkeys.WM_SYSKEYUP;
        if (!down && !up) return NativeHotkeys.CallNextHookEx(hook, code, wParam, lParam);
        if (!IsEldenRingForeground())
        {
            lock (Sync)
            {
                PressedKeys.Clear();
                SuppressedKeys.Clear();
                ActiveMacros.Clear();
            }
            return NativeHotkeys.CallNextHookEx(hook, code, wParam, lParam);
        }

        ushort key = (ushort)data.vkCode;
        bool suppress = false;
        lock (Sync)
        {
            if (down)
            {
                PressedKeys.Add(key);
                suppress = SuppressedKeys.Contains(key);
            }
            if (up)
            {
                suppress = SuppressedKeys.Remove(key);
                PressedKeys.Remove(key);
            }

            foreach (HotkeyMacro macro in config.Macros)
            {
                bool satisfied = macro.TriggerKeys.All(trigger => PressedKeys.Contains(trigger));
                if (!satisfied) ActiveMacros.Remove(macro.Id);
            }
            HotkeyMacro matched = down
                ? config.Macros
                    .Where(macro => key == macro.ActivationKey && macro.TriggerKeys.All(trigger => PressedKeys.Contains(trigger)) && !ActiveMacros.Contains(macro.Id))
                    .OrderByDescending(macro => macro.TriggerKeys.Count)
                    .FirstOrDefault()
                : null;
            if (matched != null)
            {
                ActiveMacros.Add(matched.Id);
                SuppressedKeys.Add(key);
                suppress = true;
                Interlocked.Increment(ref pendingMacros);
                ThreadPool.QueueUserWorkItem(_ => ExecuteMacro(matched));
            }
        }
        return suppress ? new IntPtr(1) : NativeHotkeys.CallNextHookEx(hook, code, wParam, lParam);
    }

    private static bool IsEldenRingForeground()
    {
        try
        {
            IntPtr window = NativeHotkeys.GetForegroundWindow();
            if (window == IntPtr.Zero) return false;
            uint processId;
            NativeHotkeys.GetWindowThreadProcessId(window, out processId);
            if (processId == 0) return false;
            using (Process process = Process.GetProcessById((int)processId))
            {
                string name = process.ProcessName;
                return name.Equals("eldenring", StringComparison.OrdinalIgnoreCase) ||
                       name.Equals("start_protected_game", StringComparison.OrdinalIgnoreCase);
            }
        }
        catch { return false; }
    }

    private static void ExecuteMacro(HotkeyMacro macro)
    {
        try
        {
            lock (OutputSync)
            {
                if (!running || !IsEldenRingForeground()) return;
                List<InputControl> pressed = new List<InputControl>();
                bool completed = true;
                try
                {
                    foreach (HotkeyAction action in macro.Actions)
                    {
                        if (!running || !IsEldenRingForeground())
                        {
                            completed = false;
                            break;
                        }
                        if (action.Type == "WAIT")
                        {
                            if (!SleepWhileActive(action.DurationMs)) completed = false;
                        }
                        else if (action.Type == "TAP")
                        {
                            PressControls(action.Controls, pressed);
                            if (!SleepWhileActive(action.DurationMs)) completed = false;
                            if (completed)
                            {
                                ReleaseControls(action.Controls, pressed);
                            }
                        }
                        else if (action.Type == "DOWN")
                        {
                            PressControls(action.Controls, pressed);
                        }
                        else if (action.Type == "UP")
                        {
                            ReleaseControls(action.Controls, pressed);
                        }
                        if (!completed) break;
                    }
                }
                finally
                {
                    for (int index = pressed.Count - 1; index >= 0; index--)
                    {
                        try { SendControl(pressed[index], true); }
                        catch { }
                    }
                }
                if (completed) WriteState("TRIGGERED", macro.Id);
            }
        }
        catch (Exception error)
        {
            WriteState("ERROR", "MACRO_EXECUTION_FAILED\t" + Sanitize(error.Message));
        }
        finally
        {
            Interlocked.Decrement(ref pendingMacros);
        }
    }

    private static bool SleepWhileActive(int durationMs)
    {
        int remaining = durationMs;
        while (remaining > 0)
        {
            if (!running || !IsEldenRingForeground()) return false;
            int slice = Math.Min(20, remaining);
            Thread.Sleep(slice);
            remaining -= slice;
        }
        return running && IsEldenRingForeground();
    }

    private static void PressControls(InputControl[] controls, List<InputControl> pressed)
    {
        foreach (InputControl control in controls)
        {
            SendControl(control, false);
            pressed.Add(control);
        }
    }

    private static void ReleaseControls(InputControl[] controls, List<InputControl> pressed)
    {
        for (int index = controls.Length - 1; index >= 0; index--)
        {
            SendControl(controls[index], true);
            pressed.Remove(controls[index]);
        }
    }

    private static void SendControl(InputControl control, bool up)
    {
        NativeHotkeys.Input input;
        if (control.IsMouse)
        {
            input = new NativeHotkeys.Input
            {
                type = NativeHotkeys.INPUT_MOUSE,
                data = new NativeHotkeys.InputUnion
                {
                    mouse = new NativeHotkeys.MouseInput
                    {
                        dx = 0,
                        dy = 0,
                        mouseData = control.MouseData,
                        dwFlags = up ? control.MouseUpFlag : control.MouseDownFlag,
                        time = 0,
                        dwExtraInfo = UIntPtr.Zero
                    }
                }
            };
        }
        else
        {
            ushort scanCode = (ushort)NativeHotkeys.MapVirtualKey(control.VirtualKey, 0);
            if (scanCode == 0) throw new HotkeyFailure("SCAN_CODE_NOT_FOUND", control.Code);
            uint flags = NativeHotkeys.KEYEVENTF_SCANCODE;
            if (control.Extended) flags |= NativeHotkeys.KEYEVENTF_EXTENDEDKEY;
            if (up) flags |= NativeHotkeys.KEYEVENTF_KEYUP;
            input = new NativeHotkeys.Input
            {
                type = NativeHotkeys.INPUT_KEYBOARD,
                data = new NativeHotkeys.InputUnion
                {
                    keyboard = new NativeHotkeys.KeyboardInput
                    {
                        // CrossOver/Wine uses wVk to maintain modifier state even
                        // when KEYEVENTF_SCANCODE is present. Keep both fields so
                        // Raw Input receives the hardware scan code while Ctrl,
                        // Shift and Alt are also visible as held virtual keys.
                        wVk = control.VirtualKey,
                        wScan = scanCode,
                        dwFlags = flags,
                        time = 0,
                        dwExtraInfo = UIntPtr.Zero
                    }
                }
            };
        }
        uint sent = NativeHotkeys.SendInput(1, new[] { input }, Marshal.SizeOf(typeof(NativeHotkeys.Input)));
        if (sent != 1) throw new HotkeyFailure("SEND_INPUT_FAILED", Marshal.GetLastWin32Error().ToString(CultureInfo.InvariantCulture));
    }

    private static void WriteState(string state, string detail)
    {
        Console.WriteLine("EROVERLY_HOTKEY_STATE\t" + state + "\t" + Sanitize(detail));
        Console.Out.Flush();
    }

    private static string Sanitize(string value)
    {
        return (value ?? "").Replace('\r', ' ').Replace('\n', ' ');
    }
}
