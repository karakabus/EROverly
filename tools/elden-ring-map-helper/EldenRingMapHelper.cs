using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

internal sealed class HelperFailure : Exception
{
    public string Code { get; private set; }

    public HelperFailure(string code, string message) : base(message)
    {
        Code = code;
    }
}

internal sealed class BitOperation
{
    public long ByteOffset;
    public long PointerOffset;
    public int Bit;
}

internal sealed class BossCommand
{
    public string Id;
    public bool Dead;
    public readonly List<BitOperation> Operations = new List<BitOperation>();
    public BitOperation DisplayOperation;
}

internal sealed class CharacterStatField
{
    public string Key;
    public long Offset;
    public int Min;
    public int Max;
    public bool HasTarget;
    public int Target;
}

internal sealed class InvincibilityField
{
    public string Key;
    public long Offset;
    public bool HasTarget;
    public bool Target;
}

internal sealed class MapManifest
{
    public bool IsRuneCommand;
    public bool IsItemCommand;
    public bool IsBossCommand;
    public bool IsCharacterStatsCommand;
    public bool IsInvincibilityCommand;
    public List<byte?> Pattern = new List<byte?>();
    public int RipOffset;
    public int RipAdditional;
    public readonly List<string> Actions = new List<string>();
    public readonly List<BitOperation> Operations = new List<BitOperation>();
    public List<byte?> WorldPattern = new List<byte?>();
    public int WorldRipOffset;
    public int WorldRipAdditional;
    public List<byte?> AddSoulPattern = new List<byte?>();
    public long LocalPlayerOffset;
    public long RuneContainerOffset;
    public long RuneValueOffset;
    public int RuneAmount;
    public List<byte?> InventoryPattern = new List<byte?>();
    public long InventoryDisplacementOffset;
    public long InventoryRipAdditional;
    public List<byte?> AddItemPattern = new List<byte?>();
    public uint ItemEncodedId;
    public int ItemQuantity;
    public readonly List<BossCommand> Bosses = new List<BossCommand>();
    public List<byte?> GameDataPattern = new List<byte?>();
    public int GameDataRipOffset;
    public int GameDataRipAdditional;
    public long CharacterDataPointerOffset;
    public readonly List<CharacterStatField> CharacterStats = new List<CharacterStatField>();
    public readonly List<InvincibilityField> InvincibilityFields = new List<InvincibilityField>();

    public static MapManifest Load(string manifestPath)
    {
        if (!File.Exists(manifestPath))
            throw new HelperFailure("MANIFEST_NOT_FOUND", manifestPath);

        string[] lines = File.ReadAllLines(manifestPath);
        if (lines.Length == 0 ||
            (lines[0].Trim() != "EROVERLY_MAPS_V1" &&
             lines[0].Trim() != "EROVERLY_RUNES_V1" &&
             lines[0].Trim() != "EROVERLY_ITEM_V1" &&
             lines[0].Trim() != "EROVERLY_BOSSES_V1" &&
             lines[0].Trim() != "EROVERLY_CHARACTER_STATS_V1" &&
             lines[0].Trim() != "EROVERLY_INVINCIBILITY_V1"))
            throw new HelperFailure("MANIFEST_VERSION", "Unsupported command manifest.");

        MapManifest manifest = new MapManifest();
        manifest.IsRuneCommand = lines[0].Trim() == "EROVERLY_RUNES_V1";
        manifest.IsItemCommand = lines[0].Trim() == "EROVERLY_ITEM_V1";
        manifest.IsBossCommand = lines[0].Trim() == "EROVERLY_BOSSES_V1";
        manifest.IsCharacterStatsCommand = lines[0].Trim() == "EROVERLY_CHARACTER_STATS_V1";
        manifest.IsInvincibilityCommand = lines[0].Trim() == "EROVERLY_INVINCIBILITY_V1";
        BossCommand currentBoss = null;
        for (int index = 1; index < lines.Length; index++)
        {
            string line = lines[index].Trim();
            if (line.Length == 0) continue;
            string[] fields = line.Split('\t');

            if (fields[0] == "PATTERN" && fields.Length == 2)
            {
                foreach (string token in fields[1].Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
                {
                    if (token == "??") manifest.Pattern.Add(null);
                    else manifest.Pattern.Add(byte.Parse(token, NumberStyles.HexNumber, CultureInfo.InvariantCulture));
                }
            }
            else if (fields[0] == "RIP" && fields.Length == 3)
            {
                manifest.RipOffset = ParseDecimal(fields[1], "MANIFEST_RIP");
                manifest.RipAdditional = ParseDecimal(fields[2], "MANIFEST_RIP");
            }
            else if (fields[0] == "ACTION" && fields.Length == 2)
            {
                if (fields[1] != "mainGameMaps" &&
                    fields[1] != "dlcMaps" &&
                    fields[1] != "mainGameGraces" &&
                    fields[1] != "dlcGraces")
                    throw new HelperFailure("MANIFEST_ACTION", fields[1]);
                manifest.Actions.Add(fields[1]);
            }
            else if (fields[0] == "BIT" && fields.Length == 4)
            {
                int bit = ParseDecimal(fields[3], "MANIFEST_BIT");
                if (bit < 0 || bit > 7) throw new HelperFailure("MANIFEST_BIT", fields[3]);
                manifest.Operations.Add(new BitOperation
                {
                    ByteOffset = ParseHex(fields[1], "MANIFEST_OFFSET"),
                    PointerOffset = ParseHex(fields[2], "MANIFEST_OFFSET"),
                    Bit = bit
                });
            }
            else if (fields[0] == "BOSS" && fields.Length == 3)
            {
                int target = ParseDecimal(fields[2], "MANIFEST_BOSS_TARGET");
                if (fields[1].Length == 0 || (target != 0 && target != 1))
                    throw new HelperFailure("MANIFEST_BOSS", "Line " + (index + 1));
                currentBoss = new BossCommand { Id = fields[1], Dead = target == 1 };
                manifest.Bosses.Add(currentBoss);
            }
            else if (fields[0] == "BOSS_BIT" && fields.Length == 4)
            {
                if (currentBoss == null) throw new HelperFailure("MANIFEST_BOSS_ORDER", "Line " + (index + 1));
                currentBoss.Operations.Add(ParseBitOperation(fields));
            }
            else if (fields[0] == "DISPLAY_BIT" && fields.Length == 4)
            {
                if (currentBoss == null || currentBoss.DisplayOperation != null)
                    throw new HelperFailure("MANIFEST_BOSS_ORDER", "Line " + (index + 1));
                currentBoss.DisplayOperation = ParseBitOperation(fields);
            }
            else if (fields[0] == "GAME_DATA_PATTERN" && fields.Length == 2)
            {
                manifest.GameDataPattern = ParsePattern(fields[1]);
            }
            else if (fields[0] == "GAME_DATA_RIP" && fields.Length == 3)
            {
                manifest.GameDataRipOffset = ParseDecimal(fields[1], "MANIFEST_GAME_DATA_RIP");
                manifest.GameDataRipAdditional = ParseDecimal(fields[2], "MANIFEST_GAME_DATA_RIP");
            }
            else if (fields[0] == "DATA_POINTER" && fields.Length == 2)
            {
                manifest.CharacterDataPointerOffset = ParseHex(fields[1], "MANIFEST_CHARACTER_DATA_POINTER");
            }
            else if (fields[0] == "STAT_FIELD" && fields.Length == 5)
            {
                if (FindCharacterStat(manifest.CharacterStats, fields[1]) != null)
                    throw new HelperFailure("MANIFEST_CHARACTER_STAT_DUPLICATE", fields[1]);
                int min = ParseDecimal(fields[3], "MANIFEST_CHARACTER_STAT_RANGE");
                int max = ParseDecimal(fields[4], "MANIFEST_CHARACTER_STAT_RANGE");
                if (fields[1].Length == 0 || min < 0 || max < min)
                    throw new HelperFailure("MANIFEST_CHARACTER_STAT_RANGE", fields[1]);
                manifest.CharacterStats.Add(new CharacterStatField
                {
                    Key = fields[1],
                    Offset = ParseHex(fields[2], "MANIFEST_CHARACTER_STAT_OFFSET"),
                    Min = min,
                    Max = max
                });
            }
            else if (fields[0] == "STAT_SET" && fields.Length == 3)
            {
                CharacterStatField field = FindCharacterStat(manifest.CharacterStats, fields[1]);
                if (field == null || field.HasTarget)
                    throw new HelperFailure("MANIFEST_CHARACTER_STAT_ORDER", fields[1]);
                int target = ParseDecimal(fields[2], "MANIFEST_CHARACTER_STAT_VALUE");
                if (target < field.Min || target > field.Max)
                    throw new HelperFailure("MANIFEST_CHARACTER_STAT_VALUE", fields[1] + ":" + target);
                field.HasTarget = true;
                field.Target = target;
            }
            else if (fields[0] == "INVINCIBILITY_FIELD" && fields.Length == 3)
            {
                if (FindInvincibilityField(manifest.InvincibilityFields, fields[1]) != null || fields[1].Length == 0)
                    throw new HelperFailure("MANIFEST_INVINCIBILITY_FIELD", fields[1]);
                manifest.InvincibilityFields.Add(new InvincibilityField
                {
                    Key = fields[1],
                    Offset = ParseHex(fields[2], "MANIFEST_INVINCIBILITY_OFFSET")
                });
            }
            else if (fields[0] == "INVINCIBILITY_SET" && fields.Length == 3)
            {
                InvincibilityField field = FindInvincibilityField(manifest.InvincibilityFields, fields[1]);
                int target = ParseDecimal(fields[2], "MANIFEST_INVINCIBILITY_VALUE");
                if (field == null || field.HasTarget || (target != 0 && target != 1))
                    throw new HelperFailure("MANIFEST_INVINCIBILITY_SET", fields[1]);
                field.HasTarget = true;
                field.Target = target == 1;
            }
            else if (fields[0] == "WORLD_PATTERN" && fields.Length == 2)
            {
                manifest.WorldPattern = ParsePattern(fields[1]);
            }
            else if (fields[0] == "WORLD_RIP" && fields.Length == 3)
            {
                manifest.WorldRipOffset = ParseDecimal(fields[1], "MANIFEST_WORLD_RIP");
                manifest.WorldRipAdditional = ParseDecimal(fields[2], "MANIFEST_WORLD_RIP");
            }
            else if (fields[0] == "ADD_SOUL_PATTERN" && fields.Length == 2)
            {
                manifest.AddSoulPattern = ParsePattern(fields[1]);
            }
            else if (fields[0] == "POINTERS" && fields.Length == 4)
            {
                manifest.LocalPlayerOffset = ParseHex(fields[1], "MANIFEST_POINTERS");
                manifest.RuneContainerOffset = ParseHex(fields[2], "MANIFEST_POINTERS");
                manifest.RuneValueOffset = ParseHex(fields[3], "MANIFEST_POINTERS");
            }
            else if (fields[0] == "AMOUNT" && fields.Length == 2)
            {
                manifest.RuneAmount = ParseDecimal(fields[1], "MANIFEST_RUNE_AMOUNT");
            }
            else if (fields[0] == "INVENTORY_PATTERN" && fields.Length == 2)
            {
                manifest.InventoryPattern = ParsePattern(fields[1]);
            }
            else if (fields[0] == "INVENTORY_ACCESSOR" && fields.Length == 3)
            {
                manifest.InventoryDisplacementOffset = ParseHex(fields[1], "MANIFEST_INVENTORY_ACCESSOR");
                manifest.InventoryRipAdditional = ParseHex(fields[2], "MANIFEST_INVENTORY_ACCESSOR");
            }
            else if (fields[0] == "ADD_ITEM_PATTERN" && fields.Length == 2)
            {
                manifest.AddItemPattern = ParsePattern(fields[1]);
            }
            else if (fields[0] == "ITEM" && fields.Length == 3)
            {
                manifest.ItemEncodedId = ParseUInt32Hex(fields[1], "MANIFEST_ITEM_ID");
                manifest.ItemQuantity = ParseDecimal(fields[2], "MANIFEST_ITEM_QUANTITY");
            }
            else
            {
                throw new HelperFailure("MANIFEST_LINE", "Line " + (index + 1));
            }
        }

        if (manifest.IsInvincibilityCommand)
        {
            if (manifest.Pattern.Count < 8 || manifest.InvincibilityFields.Count == 0)
                throw new HelperFailure("MANIFEST_INCOMPLETE", "Invincibility command data is missing or invalid.");
            if (manifest.RipOffset < 0 || manifest.RipAdditional <= 0)
                throw new HelperFailure("MANIFEST_RIP", "Invalid debug-flag RIP-relative configuration.");
        }
        else if (manifest.IsCharacterStatsCommand)
        {
            if (manifest.GameDataPattern.Count < 8 || manifest.CharacterStats.Count == 0)
                throw new HelperFailure("MANIFEST_INCOMPLETE", "Character stat command data is missing or invalid.");
            if (manifest.GameDataRipOffset < 0 || manifest.GameDataRipAdditional <= 0 || manifest.CharacterDataPointerOffset <= 0)
                throw new HelperFailure("MANIFEST_GAME_DATA_POINTER", "Character data pointer configuration is invalid.");
        }
        else if (manifest.IsBossCommand)
        {
            if (manifest.Pattern.Count < 8 || manifest.Bosses.Count == 0)
                throw new HelperFailure("MANIFEST_INCOMPLETE", "Boss command data is missing or invalid.");
            if (manifest.RipOffset < 0 || manifest.RipAdditional <= 0)
                throw new HelperFailure("MANIFEST_RIP", "Invalid RIP-relative configuration.");
            foreach (BossCommand boss in manifest.Bosses)
            {
                if (boss.DisplayOperation == null)
                    throw new HelperFailure("MANIFEST_BOSS_DISPLAY", boss.Id);
            }
        }
        else if (manifest.IsItemCommand)
        {
            if (manifest.InventoryPattern.Count < 8 || manifest.AddItemPattern.Count < 8)
                throw new HelperFailure("MANIFEST_INCOMPLETE", "Item command patterns are missing or invalid.");
            if (manifest.InventoryDisplacementOffset <= 0 || manifest.InventoryRipAdditional <= 0)
                throw new HelperFailure("MANIFEST_INVENTORY_ACCESSOR", "Item accessor configuration is invalid.");
            if (manifest.ItemQuantity < 1 || manifest.ItemQuantity > 999)
                throw new HelperFailure("MANIFEST_ITEM_QUANTITY", manifest.ItemQuantity.ToString(CultureInfo.InvariantCulture));
        }
        else if (manifest.IsRuneCommand)
        {
            if (manifest.WorldPattern.Count < 8 || manifest.AddSoulPattern.Count < 4 || manifest.RuneAmount < 1 || manifest.RuneAmount > 999999999)
                throw new HelperFailure("MANIFEST_INCOMPLETE", "Rune command data is missing or invalid.");
            if (manifest.WorldRipOffset < 0 || manifest.WorldRipAdditional <= 0 || manifest.LocalPlayerOffset <= 0 || manifest.RuneContainerOffset <= 0)
                throw new HelperFailure("MANIFEST_POINTERS", "Rune pointer configuration is invalid.");
        }
        else
        {
            if (manifest.Pattern.Count < 8 || manifest.Actions.Count == 0 || manifest.Operations.Count == 0)
                throw new HelperFailure("MANIFEST_INCOMPLETE", "Pattern, action, or bit operation is missing.");
            if (manifest.RipOffset < 0 || manifest.RipAdditional <= 0)
                throw new HelperFailure("MANIFEST_RIP", "Invalid RIP-relative configuration.");
        }
        return manifest;
    }

    private static CharacterStatField FindCharacterStat(List<CharacterStatField> fields, string key)
    {
        foreach (CharacterStatField field in fields)
        {
            if (field.Key == key) return field;
        }
        return null;
    }

    private static InvincibilityField FindInvincibilityField(List<InvincibilityField> fields, string key)
    {
        foreach (InvincibilityField field in fields)
        {
            if (field.Key == key) return field;
        }
        return null;
    }

    private static BitOperation ParseBitOperation(string[] fields)
    {
        int bit = ParseDecimal(fields[3], "MANIFEST_BIT");
        if (bit < 0 || bit > 7) throw new HelperFailure("MANIFEST_BIT", fields[3]);
        return new BitOperation
        {
            ByteOffset = ParseHex(fields[1], "MANIFEST_OFFSET"),
            PointerOffset = ParseHex(fields[2], "MANIFEST_OFFSET"),
            Bit = bit
        };
    }

    private static List<byte?> ParsePattern(string value)
    {
        List<byte?> pattern = new List<byte?>();
        foreach (string token in value.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries))
        {
            if (token == "??") pattern.Add(null);
            else pattern.Add(byte.Parse(token, NumberStyles.HexNumber, CultureInfo.InvariantCulture));
        }
        return pattern;
    }

    private static int ParseDecimal(string value, string code)
    {
        int result;
        if (!int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out result))
            throw new HelperFailure(code, value);
        return result;
    }

    private static long ParseHex(string value, string code)
    {
        long result;
        if (!long.TryParse(value, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out result))
            throw new HelperFailure(code, value);
        return result;
    }

    private static uint ParseUInt32Hex(string value, string code)
    {
        uint result;
        if (!uint.TryParse(value, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out result))
            throw new HelperFailure(code, value);
        return result;
    }
}

internal static class NativeMethods
{
    public const uint PROCESS_CREATE_THREAD = 0x0002;
    public const uint PROCESS_VM_OPERATION = 0x0008;
    public const uint PROCESS_VM_READ = 0x0010;
    public const uint PROCESS_VM_WRITE = 0x0020;
    public const uint PROCESS_QUERY_INFORMATION = 0x0400;
    public const uint MEM_COMMIT = 0x1000;
    public const uint MEM_RESERVE = 0x2000;
    public const uint MEM_RELEASE = 0x8000;
    public const uint PAGE_EXECUTE_READWRITE = 0x40;
    public const uint WAIT_OBJECT_0 = 0x00000000;
    public const uint WAIT_TIMEOUT = 0x00000102;

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ReadProcessMemory(
        IntPtr process,
        IntPtr baseAddress,
        [Out] byte[] buffer,
        IntPtr size,
        out IntPtr bytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool WriteProcessMemory(
        IntPtr process,
        IntPtr baseAddress,
        byte[] buffer,
        IntPtr size,
        out IntPtr bytesWritten);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr VirtualAllocEx(
        IntPtr process,
        IntPtr address,
        IntPtr size,
        uint allocationType,
        uint protection);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool VirtualFreeEx(IntPtr process, IntPtr address, IntPtr size, uint freeType);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr CreateRemoteThread(
        IntPtr process,
        IntPtr threadAttributes,
        IntPtr stackSize,
        IntPtr startAddress,
        IntPtr parameter,
        uint creationFlags,
        out uint threadId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool FlushInstructionCache(IntPtr process, IntPtr baseAddress, IntPtr size);

    [DllImport("kernel32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr handle);
}

internal sealed class ProcessMemory : IDisposable
{
    private readonly IntPtr handle;

    public ProcessMemory(Process process)
    {
        uint access = NativeMethods.PROCESS_CREATE_THREAD |
                      NativeMethods.PROCESS_QUERY_INFORMATION |
                      NativeMethods.PROCESS_VM_OPERATION |
                      NativeMethods.PROCESS_VM_READ |
                      NativeMethods.PROCESS_VM_WRITE;
        handle = NativeMethods.OpenProcess(access, false, process.Id);
        if (handle == IntPtr.Zero)
            throw new HelperFailure("OPEN_PROCESS_FAILED", Marshal.GetLastWin32Error().ToString(CultureInfo.InvariantCulture));
    }

    public byte[] Read(long address, int length)
    {
        byte[] buffer = new byte[length];
        IntPtr bytesRead;
        bool ok = NativeMethods.ReadProcessMemory(handle, new IntPtr(address), buffer, new IntPtr(length), out bytesRead);
        if (!ok || bytesRead.ToInt64() != length)
            throw new HelperFailure("READ_MEMORY_FAILED", "0x" + address.ToString("X", CultureInfo.InvariantCulture));
        return buffer;
    }

    public bool TryRead(long address, byte[] buffer, int length, out int bytesRead)
    {
        IntPtr nativeBytesRead;
        bool ok = NativeMethods.ReadProcessMemory(handle, new IntPtr(address), buffer, new IntPtr(length), out nativeBytesRead);
        bytesRead = (int)Math.Max(0, Math.Min(length, nativeBytesRead.ToInt64()));
        return ok && bytesRead > 0;
    }

    public void WriteByte(long address, byte value)
    {
        IntPtr bytesWritten;
        bool ok = NativeMethods.WriteProcessMemory(handle, new IntPtr(address), new[] { value }, new IntPtr(1), out bytesWritten);
        if (!ok || bytesWritten.ToInt64() != 1)
            throw new HelperFailure("WRITE_MEMORY_FAILED", "0x" + address.ToString("X", CultureInfo.InvariantCulture));
    }

    public void Write(long address, byte[] value)
    {
        IntPtr bytesWritten;
        bool ok = NativeMethods.WriteProcessMemory(handle, new IntPtr(address), value, new IntPtr(value.Length), out bytesWritten);
        if (!ok || bytesWritten.ToInt64() != value.Length)
            throw new HelperFailure("WRITE_MEMORY_FAILED", "0x" + address.ToString("X", CultureInfo.InvariantCulture));
    }

    public void WriteInt32(long address, int value)
    {
        Write(address, BitConverter.GetBytes(value));
    }

    public long AllocateExecutable(int size)
    {
        IntPtr address = NativeMethods.VirtualAllocEx(
            handle,
            IntPtr.Zero,
            new IntPtr(size),
            NativeMethods.MEM_COMMIT | NativeMethods.MEM_RESERVE,
            NativeMethods.PAGE_EXECUTE_READWRITE);
        if (address == IntPtr.Zero)
            throw new HelperFailure("ALLOCATE_REMOTE_CODE_FAILED", Marshal.GetLastWin32Error().ToString(CultureInfo.InvariantCulture));
        return address.ToInt64();
    }

    public void Free(long address)
    {
        if (!NativeMethods.VirtualFreeEx(handle, new IntPtr(address), IntPtr.Zero, NativeMethods.MEM_RELEASE))
            throw new HelperFailure("FREE_REMOTE_CODE_FAILED", Marshal.GetLastWin32Error().ToString(CultureInfo.InvariantCulture));
    }

    public void Execute(long address, int codeSize, int timeoutMilliseconds, string operation)
    {
        if (!NativeMethods.FlushInstructionCache(handle, new IntPtr(address), new IntPtr(codeSize)))
            throw new HelperFailure("FLUSH_INSTRUCTION_CACHE_FAILED", Marshal.GetLastWin32Error().ToString(CultureInfo.InvariantCulture));
        uint threadId;
        IntPtr thread = NativeMethods.CreateRemoteThread(
            handle,
            IntPtr.Zero,
            IntPtr.Zero,
            new IntPtr(address),
            IntPtr.Zero,
            0,
            out threadId);
        if (thread == IntPtr.Zero)
            throw new HelperFailure("CREATE_REMOTE_THREAD_FAILED", Marshal.GetLastWin32Error().ToString(CultureInfo.InvariantCulture));
        try
        {
            uint wait = NativeMethods.WaitForSingleObject(thread, (uint)timeoutMilliseconds);
            if (wait == NativeMethods.WAIT_TIMEOUT) throw new HelperFailure(operation + "_CALL_TIMEOUT", threadId.ToString(CultureInfo.InvariantCulture));
            if (wait != NativeMethods.WAIT_OBJECT_0) throw new HelperFailure(operation + "_CALL_WAIT_FAILED", wait.ToString(CultureInfo.InvariantCulture));
        }
        finally
        {
            NativeMethods.CloseHandle(thread);
        }
    }

    public long ReadInt64(long address)
    {
        return BitConverter.ToInt64(Read(address, 8), 0);
    }

    public int ReadInt32(long address)
    {
        return BitConverter.ToInt32(Read(address, 4), 0);
    }

    public uint ReadUInt32(long address)
    {
        return BitConverter.ToUInt32(Read(address, 4), 0);
    }

    public void Dispose()
    {
        if (handle != IntPtr.Zero) NativeMethods.CloseHandle(handle);
    }
}

internal sealed class BytePatch
{
    public long Address;
    public byte Original;
    public byte Updated;
}

internal sealed class Int32Patch
{
    public string Key;
    public long Address;
    public int Original;
    public int Updated;
}

internal static class EldenRingMapHelper
{
    private const int ScanChunkBytes = 256 * 1024;

    private static int Main(string[] args)
    {
        try
        {
            if (args.Length != 2 || (args[0] != "--validate" && args[0] != "--apply" && args[0] != "--inspect"))
                throw new HelperFailure("ARGUMENTS", "Use --validate, --inspect, or --apply followed by a manifest path.");

            MapManifest manifest = MapManifest.Load(args[1]);
            if (args[0] == "--validate")
            {
                string validationDetail;
                if (manifest.IsInvincibilityCommand)
                    validationDetail = "invincibility:" + manifest.InvincibilityFields.Count;
                else if (manifest.IsCharacterStatsCommand)
                    validationDetail = "character-stats:" + manifest.CharacterStats.Count;
                else if (manifest.IsBossCommand)
                    validationDetail = "bosses:" + manifest.Bosses.Count;
                else if (manifest.IsItemCommand)
                    validationDetail = "item:" + manifest.ItemEncodedId.ToString("X8", CultureInfo.InvariantCulture) + ":" + manifest.ItemQuantity;
                else if (manifest.IsRuneCommand)
                    validationDetail = "runes:" + manifest.RuneAmount;
                else
                    validationDetail = manifest.Actions.Count + ":" + manifest.Operations.Count;
                WriteResult("OK", "VALID", validationDetail);
                return 0;
            }

            if (args[0] == "--inspect")
            {
                if (manifest.IsInvincibilityCommand)
                {
                    InspectInvincibility(manifest);
                    WriteResult("OK", "INVINCIBILITY_INSPECTED", manifest.InvincibilityFields.Count.ToString(CultureInfo.InvariantCulture));
                }
                else if (manifest.IsBossCommand)
                {
                    InspectBosses(manifest);
                    WriteResult("OK", "BOSSES_INSPECTED", manifest.Bosses.Count.ToString(CultureInfo.InvariantCulture));
                }
                else if (manifest.IsCharacterStatsCommand)
                {
                    InspectCharacterStats(manifest);
                    WriteResult("OK", "CHARACTER_STATS_INSPECTED", manifest.CharacterStats.Count.ToString(CultureInfo.InvariantCulture));
                }
                else
                {
                    throw new HelperFailure("INSPECT_COMMAND", "Only invincibility, boss, and character stat manifests support inspection.");
                }
                return 0;
            }

            if (manifest.IsInvincibilityCommand)
            {
                int changed;
                int alreadySet;
                ApplyInvincibility(manifest, out changed, out alreadySet);
                WriteResult("OK", "INVINCIBILITY_UPDATED", changed + ":" + alreadySet);
            }
            else if (manifest.IsCharacterStatsCommand)
            {
                int changed;
                int alreadySet;
                ApplyCharacterStats(manifest, out changed, out alreadySet);
                WriteResult("OK", "CHARACTER_STATS_UPDATED", changed + ":" + alreadySet);
            }
            else if (manifest.IsBossCommand)
            {
                int changed;
                int alreadySet;
                ApplyBosses(manifest, out changed, out alreadySet);
                WriteResult("OK", "BOSSES_UPDATED", changed + ":" + alreadySet);
            }
            else if (manifest.IsItemCommand)
            {
                ApplyItem(manifest);
                WriteResult(
                    "OK",
                    "ITEM_ADDED",
                    manifest.ItemEncodedId.ToString("X8", CultureInfo.InvariantCulture) + ":" + manifest.ItemQuantity);
            }
            else if (manifest.IsRuneCommand)
            {
                uint before;
                uint after;
                ApplyRunes(manifest, out before, out after);
                WriteResult("OK", "RUNES_ADDED", manifest.RuneAmount + ":" + before + ":" + after);
            }
            else
            {
                int changed;
                int alreadySet;
                ApplyMaps(manifest, out changed, out alreadySet);
                WriteResult("OK", "APPLIED", changed + ":" + alreadySet);
            }
            return 0;
        }
        catch (HelperFailure failure)
        {
            WriteResult("ERROR", failure.Code, failure.Message);
            return 2;
        }
        catch (Exception error)
        {
            WriteResult("ERROR", "UNEXPECTED", error.GetType().Name + ": " + error.Message);
            return 3;
        }
    }

    private static Process FindGameProcess()
    {
        if (Process.GetProcessesByName("EasyAntiCheat_EOS").Length > 0)
            throw new HelperFailure("ANTI_CHEAT_RUNNING", "Easy Anti-Cheat is running.");

        List<Process> gameCandidates = new List<Process>();
        gameCandidates.AddRange(Process.GetProcessesByName("eldenring"));
        gameCandidates.AddRange(Process.GetProcessesByName("start_protected_game"));
        if (gameCandidates.Count == 0)
            throw new HelperFailure("GAME_NOT_RUNNING", "eldenring.exe or the offline start_protected_game.exe was not found.");
        if (gameCandidates.Count != 1)
            throw new HelperFailure("MULTIPLE_GAME_PROCESSES", gameCandidates.Count.ToString(CultureInfo.InvariantCulture));
        return gameCandidates[0];
    }

    private static void ApplyMaps(MapManifest manifest, out int changed, out int alreadySet)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            ProcessModule module;
            try { module = game.MainModule; }
            catch (Exception error) { throw new HelperFailure("GAME_MODULE_FAILED", error.Message); }
            if (module == null) throw new HelperFailure("GAME_MODULE_FAILED", "Main module is unavailable.");

            long moduleBase = module.BaseAddress.ToInt64();
            long textAddress;
            int textSize;
            ReadTextSection(memory, moduleBase, out textAddress, out textSize);
            long patternAddress = FindUniquePattern(memory, textAddress, textSize, manifest.Pattern, "EventFlagMan");
            int displacement = memory.ReadInt32(patternAddress + manifest.RipOffset);
            long eventFlagSymbol = patternAddress + displacement + manifest.RipAdditional;
            long eventFlagManager = memory.ReadInt64(eventFlagSymbol);
            if (eventFlagManager < 0x10000) throw new HelperFailure("EVENT_FLAG_MANAGER_NULL", "EventFlagMan is not ready.");

            Dictionary<long, byte> originals = new Dictionary<long, byte>();
            Dictionary<long, byte> updates = new Dictionary<long, byte>();
            foreach (BitOperation operation in manifest.Operations)
            {
                long flagsBase = memory.ReadInt64(eventFlagManager + operation.PointerOffset);
                if (flagsBase < 0x10000) throw new HelperFailure("EVENT_FLAG_BUFFER_NULL", "Map flags are not ready.");
                long target = flagsBase + operation.ByteOffset;
                byte original;
                if (!originals.TryGetValue(target, out original))
                {
                    original = memory.Read(target, 1)[0];
                    originals[target] = original;
                    updates[target] = original;
                }
                updates[target] = (byte)(updates[target] | (1 << operation.Bit));
            }

            List<BytePatch> patches = new List<BytePatch>();
            foreach (KeyValuePair<long, byte> update in updates)
            {
                patches.Add(new BytePatch
                {
                    Address = update.Key,
                    Original = originals[update.Key],
                    Updated = update.Value
                });
            }

            changed = 0;
            alreadySet = 0;
            List<BytePatch> written = new List<BytePatch>();
            try
            {
                foreach (BytePatch patch in patches)
                {
                    if (patch.Original == patch.Updated)
                    {
                        alreadySet++;
                        continue;
                    }
                    memory.WriteByte(patch.Address, patch.Updated);
                    written.Add(patch);
                    changed++;
                }
            }
            catch
            {
                for (int index = written.Count - 1; index >= 0; index--)
                {
                    try { memory.WriteByte(written[index].Address, written[index].Original); }
                    catch { }
                }
                throw;
            }
        }
    }

    private static long ResolveDebugFlags(Process game, ProcessMemory memory, MapManifest manifest)
    {
        ProcessModule module;
        try { module = game.MainModule; }
        catch (Exception error) { throw new HelperFailure("GAME_MODULE_FAILED", error.Message); }
        if (module == null) throw new HelperFailure("GAME_MODULE_FAILED", "Main module is unavailable.");

        long moduleBase = module.BaseAddress.ToInt64();
        long textAddress;
        int textSize;
        ReadTextSection(memory, moduleBase, out textAddress, out textSize);
        long patternAddress = FindUniquePattern(memory, textAddress, textSize, manifest.Pattern, "CHR_DBG_FLAGS");
        int displacement = memory.ReadInt32(patternAddress + manifest.RipOffset);
        long debugFlags = patternAddress + displacement + manifest.RipAdditional;
        if (debugFlags < 0x10000) throw new HelperFailure("DEBUG_FLAGS_NULL", "CHR_DBG_FLAGS is not ready.");
        return debugFlags;
    }

    private static void InspectInvincibility(MapManifest manifest)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            long debugFlags = ResolveDebugFlags(game, memory, manifest);
            foreach (InvincibilityField field in manifest.InvincibilityFields)
            {
                bool enabled = memory.Read(debugFlags + field.Offset, 1)[0] != 0;
                WriteInvincibilityState(field.Key, enabled);
            }
        }
    }

    private static void ApplyInvincibility(MapManifest manifest, out int changed, out int alreadySet)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            long debugFlags = ResolveDebugFlags(game, memory, manifest);
            List<BytePatch> patches = new List<BytePatch>();
            foreach (InvincibilityField field in manifest.InvincibilityFields)
            {
                if (!field.HasTarget) continue;
                long address = debugFlags + field.Offset;
                patches.Add(new BytePatch
                {
                    Address = address,
                    Original = memory.Read(address, 1)[0],
                    Updated = field.Target ? (byte)1 : (byte)0
                });
            }
            if (patches.Count == 0)
                throw new HelperFailure("MANIFEST_INVINCIBILITY_CHANGES", "No invincibility targets were provided.");

            changed = 0;
            alreadySet = 0;
            List<BytePatch> written = new List<BytePatch>();
            try
            {
                foreach (BytePatch patch in patches)
                {
                    if (patch.Original == patch.Updated) { alreadySet++; continue; }
                    memory.WriteByte(patch.Address, patch.Updated);
                    written.Add(patch);
                    changed++;
                }
                foreach (BytePatch patch in written)
                {
                    byte actual = memory.Read(patch.Address, 1)[0];
                    if (actual != patch.Updated)
                        throw new HelperFailure("INVINCIBILITY_VERIFY_FAILED", patch.Updated + ":" + actual);
                }
            }
            catch
            {
                for (int index = written.Count - 1; index >= 0; index--)
                {
                    try { memory.WriteByte(written[index].Address, written[index].Original); }
                    catch { }
                }
                throw;
            }
        }
    }

    private static long ResolveEventFlagManager(Process game, ProcessMemory memory, MapManifest manifest)
    {
        ProcessModule module;
        try { module = game.MainModule; }
        catch (Exception error) { throw new HelperFailure("GAME_MODULE_FAILED", error.Message); }
        if (module == null) throw new HelperFailure("GAME_MODULE_FAILED", "Main module is unavailable.");

        long moduleBase = module.BaseAddress.ToInt64();
        long textAddress;
        int textSize;
        ReadTextSection(memory, moduleBase, out textAddress, out textSize);
        long patternAddress = FindUniquePattern(memory, textAddress, textSize, manifest.Pattern, "EventFlagMan");
        int displacement = memory.ReadInt32(patternAddress + manifest.RipOffset);
        long eventFlagSymbol = patternAddress + displacement + manifest.RipAdditional;
        long eventFlagManager = memory.ReadInt64(eventFlagSymbol);
        if (eventFlagManager < 0x10000) throw new HelperFailure("EVENT_FLAG_MANAGER_NULL", "EventFlagMan is not ready.");
        return eventFlagManager;
    }

    private static long ResolveBitAddress(ProcessMemory memory, long eventFlagManager, BitOperation operation)
    {
        long flagsBase = memory.ReadInt64(eventFlagManager + operation.PointerOffset);
        if (flagsBase < 0x10000) throw new HelperFailure("EVENT_FLAG_BUFFER_NULL", "Boss flags are not ready.");
        return flagsBase + operation.ByteOffset;
    }

    private static void InspectBosses(MapManifest manifest)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            long eventFlagManager = ResolveEventFlagManager(game, memory, manifest);
            foreach (BossCommand boss in manifest.Bosses)
            {
                BitOperation operation = boss.DisplayOperation;
                long target = ResolveBitAddress(memory, eventFlagManager, operation);
                bool dead = (memory.Read(target, 1)[0] & (1 << operation.Bit)) != 0;
                WriteBossState(boss.Id, dead);
            }
        }
    }

    private static void ApplyBosses(MapManifest manifest, out int changed, out int alreadySet)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            long eventFlagManager = ResolveEventFlagManager(game, memory, manifest);
            Dictionary<long, byte> originals = new Dictionary<long, byte>();
            Dictionary<long, byte> updates = new Dictionary<long, byte>();
            Dictionary<string, bool> bitTargets = new Dictionary<string, bool>();

            foreach (BossCommand boss in manifest.Bosses)
            {
                if (boss.Operations.Count == 0) throw new HelperFailure("MANIFEST_BOSS_BITS", boss.Id);
                foreach (BitOperation operation in boss.Operations)
                {
                    long target = ResolveBitAddress(memory, eventFlagManager, operation);
                    string bitKey = target.ToString("X", CultureInfo.InvariantCulture) + ":" + operation.Bit;
                    bool existingTarget;
                    if (bitTargets.TryGetValue(bitKey, out existingTarget) && existingTarget != boss.Dead)
                        throw new HelperFailure("BOSS_TARGET_CONFLICT", boss.Id + ":" + bitKey);
                    bitTargets[bitKey] = boss.Dead;

                    byte original;
                    if (!originals.TryGetValue(target, out original))
                    {
                        original = memory.Read(target, 1)[0];
                        originals[target] = original;
                        updates[target] = original;
                    }
                    int mask = 1 << operation.Bit;
                    updates[target] = boss.Dead
                        ? (byte)(updates[target] | mask)
                        : (byte)(updates[target] & ~mask);
                }
            }

            List<BytePatch> patches = new List<BytePatch>();
            foreach (KeyValuePair<long, byte> update in updates)
            {
                patches.Add(new BytePatch { Address = update.Key, Original = originals[update.Key], Updated = update.Value });
            }

            changed = 0;
            alreadySet = 0;
            List<BytePatch> written = new List<BytePatch>();
            try
            {
                foreach (BytePatch patch in patches)
                {
                    if (patch.Original == patch.Updated) { alreadySet++; continue; }
                    memory.WriteByte(patch.Address, patch.Updated);
                    written.Add(patch);
                    changed++;
                }
            }
            catch
            {
                for (int index = written.Count - 1; index >= 0; index--)
                {
                    try { memory.WriteByte(written[index].Address, written[index].Original); }
                    catch { }
                }
                throw;
            }
        }
    }

    private static long ResolveCharacterData(Process game, ProcessMemory memory, MapManifest manifest)
    {
        ProcessModule module;
        try { module = game.MainModule; }
        catch (Exception error) { throw new HelperFailure("GAME_MODULE_FAILED", error.Message); }
        if (module == null) throw new HelperFailure("GAME_MODULE_FAILED", "Main module is unavailable.");

        long moduleBase = module.BaseAddress.ToInt64();
        long textAddress;
        int textSize;
        ReadTextSection(memory, moduleBase, out textAddress, out textSize);
        long patternAddress = FindUniquePattern(memory, textAddress, textSize, manifest.GameDataPattern, "GameDataMan");
        int displacement = memory.ReadInt32(patternAddress + manifest.GameDataRipOffset);
        long gameDataSymbol = patternAddress + displacement + manifest.GameDataRipAdditional;
        long gameDataManager = memory.ReadInt64(gameDataSymbol);
        if (gameDataManager < 0x10000)
            throw new HelperFailure("GAME_DATA_MANAGER_NULL", "GameDataMan is not ready.");
        long characterData = memory.ReadInt64(gameDataManager + manifest.CharacterDataPointerOffset);
        if (characterData < 0x10000)
            throw new HelperFailure("CHARACTER_DATA_NULL", "Load a character before editing stats.");
        return characterData;
    }

    private static void InspectCharacterStats(MapManifest manifest)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            long characterData = ResolveCharacterData(game, memory, manifest);
            foreach (CharacterStatField field in manifest.CharacterStats)
            {
                int value = memory.ReadInt32(characterData + field.Offset);
                WriteCharacterStat(field.Key, value);
            }
        }
    }

    private static void ApplyCharacterStats(MapManifest manifest, out int changed, out int alreadySet)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            long characterData = ResolveCharacterData(game, memory, manifest);
            List<Int32Patch> patches = new List<Int32Patch>();
            Int32Patch levelPatch = null;
            foreach (CharacterStatField field in manifest.CharacterStats)
            {
                if (!field.HasTarget) continue;
                long address = characterData + field.Offset;
                Int32Patch patch = new Int32Patch
                {
                    Key = field.Key,
                    Address = address,
                    Original = memory.ReadInt32(address),
                    Updated = field.Target
                };
                if (field.Key == "level") levelPatch = patch;
                else patches.Add(patch);
            }
            if (levelPatch != null) patches.Add(levelPatch);
            if (patches.Count == 0) throw new HelperFailure("MANIFEST_CHARACTER_CHANGES", "No character stat targets were provided.");

            changed = 0;
            alreadySet = 0;
            List<Int32Patch> written = new List<Int32Patch>();
            try
            {
                foreach (Int32Patch patch in patches)
                {
                    if (patch.Original == patch.Updated) { alreadySet++; continue; }
                    memory.WriteInt32(patch.Address, patch.Updated);
                    written.Add(patch);
                    changed++;
                }
                foreach (Int32Patch patch in written)
                {
                    int actual = memory.ReadInt32(patch.Address);
                    if (actual != patch.Updated)
                        throw new HelperFailure("CHARACTER_STAT_VERIFY_FAILED", patch.Updated + ":" + actual);
                }
            }
            catch
            {
                for (int index = written.Count - 1; index >= 0; index--)
                {
                    try { memory.WriteInt32(written[index].Address, written[index].Original); }
                    catch { }
                }
                throw;
            }
        }
    }

    private static void ApplyRunes(MapManifest manifest, out uint before, out uint after)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            ProcessModule module;
            try { module = game.MainModule; }
            catch (Exception error) { throw new HelperFailure("GAME_MODULE_FAILED", error.Message); }
            if (module == null) throw new HelperFailure("GAME_MODULE_FAILED", "Main module is unavailable.");

            long moduleBase = module.BaseAddress.ToInt64();
            long textAddress;
            int textSize;
            ReadTextSection(memory, moduleBase, out textAddress, out textSize);

            long worldPatternAddress = FindUniquePattern(memory, textAddress, textSize, manifest.WorldPattern, "WorldChrMan");
            int worldDisplacement = memory.ReadInt32(worldPatternAddress + manifest.WorldRipOffset);
            long worldSymbol = worldPatternAddress + worldDisplacement + manifest.WorldRipAdditional;
            long worldManager = memory.ReadInt64(worldSymbol);
            if (worldManager < 0x10000) throw new HelperFailure("WORLD_CHR_MANAGER_NULL", "WorldChrMan is not ready.");

            long localPlayer = memory.ReadInt64(worldManager + manifest.LocalPlayerOffset);
            if (localPlayer < 0x10000) throw new HelperFailure("LOCAL_PLAYER_NULL", "Load a character before adding runes.");
            long playerData = memory.ReadInt64(localPlayer);
            if (playerData < 0x10000) throw new HelperFailure("LOCAL_PLAYER_DATA_NULL", "Player data is not ready.");
            long runeContainer = memory.ReadInt64(playerData + manifest.RuneContainerOffset);
            if (runeContainer < 0x10000) throw new HelperFailure("RUNE_CONTAINER_NULL", "Rune data is not ready.");

            before = memory.ReadUInt32(runeContainer + manifest.RuneValueOffset);
            if (before > 999999999) throw new HelperFailure("RUNE_VALUE_INVALID", before.ToString(CultureInfo.InvariantCulture));
            if ((ulong)before + (ulong)manifest.RuneAmount > 999999999UL)
            {
                uint remaining = 999999999U - before;
                throw new HelperFailure("RUNE_LIMIT_EXCEEDED", remaining.ToString(CultureInfo.InvariantCulture));
            }

            long addSoulAddress = FindUniquePattern(memory, textAddress, textSize, manifest.AddSoulPattern, "AddSoul_Call");
            byte[] thunk = BuildRuneThunk(runeContainer, manifest.RuneAmount, addSoulAddress);
            long remoteCode = memory.AllocateExecutable(thunk.Length);
            memory.Write(remoteCode, thunk);
            memory.Execute(remoteCode, thunk.Length, 10000, "RUNE");
            try { memory.Free(remoteCode); }
            catch (HelperFailure) { }

            after = memory.ReadUInt32(runeContainer + manifest.RuneValueOffset);
            uint expected = before + (uint)manifest.RuneAmount;
            if (after != expected)
                throw new HelperFailure("RUNE_RESULT_MISMATCH", before + ":" + expected + ":" + after);
        }
    }

    private static void ApplyItem(MapManifest manifest)
    {
        using (Process game = FindGameProcess())
        using (ProcessMemory memory = new ProcessMemory(game))
        {
            ProcessModule module;
            try { module = game.MainModule; }
            catch (Exception error) { throw new HelperFailure("GAME_MODULE_FAILED", error.Message); }
            if (module == null) throw new HelperFailure("GAME_MODULE_FAILED", "Main module is unavailable.");

            long moduleBase = module.BaseAddress.ToInt64();
            long textAddress;
            int textSize;
            ReadTextSection(memory, moduleBase, out textAddress, out textSize);

            long inventoryAccessor = FindUniquePattern(memory, textAddress, textSize, manifest.InventoryPattern, "InventoryAccessor");
            int displacement = memory.ReadInt32(inventoryAccessor + manifest.InventoryDisplacementOffset);
            long inventorySymbol = inventoryAccessor + manifest.InventoryRipAdditional + displacement;
            long inventoryManager = memory.ReadInt64(inventorySymbol);
            if (inventoryManager < 0x10000)
                throw new HelperFailure("INVENTORY_MANAGER_NULL", "Load a character before adding an item.");

            long addItemAddress = FindUniquePattern(memory, textAddress, textSize, manifest.AddItemPattern, "AddItemFunc");
            const int codeOffset = 0x100;
            const int allocationSize = 0x200;
            long remoteBlock = memory.AllocateExecutable(allocationSize);
            try
            {
                byte[] itemBuffer = BuildItemBuffer(manifest.ItemEncodedId, manifest.ItemQuantity);
                byte[] thunk = BuildItemThunk(inventoryManager, remoteBlock + 0x20, remoteBlock, addItemAddress);
                memory.Write(remoteBlock, itemBuffer);
                memory.Write(remoteBlock + codeOffset, thunk);
                memory.Execute(remoteBlock + codeOffset, thunk.Length, 10000, "ITEM");
            }
            finally
            {
                try { memory.Free(remoteBlock); }
                catch (HelperFailure) { }
            }
        }
    }

    private static byte[] BuildItemBuffer(uint encodedId, int quantity)
    {
        byte[] buffer = new byte[0x50];
        WriteUInt64(buffer, 0x20, 0xF00006AE00000001UL);
        WriteUInt64(buffer, 0x28, 0x0000000000000001UL);
        WriteUInt64(buffer, 0x30, 0xFFFFFFFFFFFFFFFFUL);
        WriteUInt64(buffer, 0x38, 0xFFFFFFFF00000000UL);
        WriteUInt64(buffer, 0x40, 0xFFFFFFFFFFFFFFFFUL);
        WriteUInt64(buffer, 0x48, 0xFFFFFFFF00000000UL);
        Buffer.BlockCopy(BitConverter.GetBytes(encodedId), 0, buffer, 0x24, 4);
        Buffer.BlockCopy(BitConverter.GetBytes(quantity), 0, buffer, 0x28, 4);
        return buffer;
    }

    private static void WriteUInt64(byte[] buffer, int offset, ulong value)
    {
        Buffer.BlockCopy(BitConverter.GetBytes(value), 0, buffer, offset, 8);
    }

    private static byte[] BuildItemThunk(long inventoryManager, long itemDescriptor, long scratchBuffer, long addItemAddress)
    {
        List<byte> code = new List<byte>();
        code.AddRange(new byte[] { 0x48, 0x83, 0xEC, 0x48 });
        code.AddRange(new byte[] { 0x48, 0xB9 });
        code.AddRange(BitConverter.GetBytes(inventoryManager));
        code.AddRange(new byte[] { 0x48, 0xBA });
        code.AddRange(BitConverter.GetBytes(itemDescriptor));
        code.AddRange(new byte[] { 0x49, 0xB8 });
        code.AddRange(BitConverter.GetBytes(scratchBuffer));
        code.AddRange(new byte[] { 0x45, 0x33, 0xC9 });
        code.AddRange(new byte[] { 0x48, 0xB8 });
        code.AddRange(BitConverter.GetBytes(addItemAddress));
        code.AddRange(new byte[] { 0xFF, 0xD0 });
        code.AddRange(new byte[] { 0x48, 0x83, 0xC4, 0x48, 0xC3 });
        return code.ToArray();
    }

    private static byte[] BuildRuneThunk(long runeContainer, int amount, long addSoulAddress)
    {
        List<byte> code = new List<byte>();
        code.AddRange(new byte[] { 0x48, 0x83, 0xEC, 0x48 });
        code.AddRange(new byte[] { 0x48, 0xB9 });
        code.AddRange(BitConverter.GetBytes(runeContainer));
        code.Add(0xBA);
        code.AddRange(BitConverter.GetBytes(amount));
        code.AddRange(new byte[] { 0x48, 0xB8 });
        code.AddRange(BitConverter.GetBytes(addSoulAddress));
        code.AddRange(new byte[] { 0xFF, 0xD0 });
        code.AddRange(new byte[] { 0x48, 0x83, 0xC4, 0x48, 0xC3 });
        return code.ToArray();
    }

    private static void ReadTextSection(ProcessMemory memory, long moduleBase, out long textAddress, out int textSize)
    {
        byte[] dos = memory.Read(moduleBase, 0x1000);
        if (dos[0] != (byte)'M' || dos[1] != (byte)'Z')
            throw new HelperFailure("INVALID_PE", "Missing MZ header.");
        int peOffset = BitConverter.ToInt32(dos, 0x3C);
        byte[] headers = peOffset + 512 <= dos.Length ? dos : memory.Read(moduleBase, peOffset + 512);
        if (Encoding.ASCII.GetString(headers, peOffset, 4) != "PE\0\0")
            throw new HelperFailure("INVALID_PE", "Missing PE header.");

        int sectionCount = BitConverter.ToUInt16(headers, peOffset + 6);
        int optionalHeaderSize = BitConverter.ToUInt16(headers, peOffset + 20);
        int sectionTableOffset = peOffset + 24 + optionalHeaderSize;
        int required = sectionTableOffset + sectionCount * 40;
        if (required > headers.Length) headers = memory.Read(moduleBase, required);

        for (int index = 0; index < sectionCount; index++)
        {
            int offset = sectionTableOffset + index * 40;
            string name = Encoding.ASCII.GetString(headers, offset, 8).TrimEnd('\0');
            if (name != ".text") continue;
            int virtualSize = BitConverter.ToInt32(headers, offset + 8);
            int virtualAddress = BitConverter.ToInt32(headers, offset + 12);
            int rawSize = BitConverter.ToInt32(headers, offset + 16);
            textAddress = moduleBase + virtualAddress;
            textSize = Math.Max(virtualSize, rawSize);
            if (textSize <= 0) throw new HelperFailure("TEXT_SECTION_EMPTY", ".text");
            return;
        }
        throw new HelperFailure("TEXT_SECTION_NOT_FOUND", ".text");
    }

    private static long FindUniquePattern(ProcessMemory memory, long start, int size, List<byte?> pattern, string patternName)
    {
        long found = 0;
        int foundCount = 0;
        int overlap = pattern.Count - 1;
        int step = ScanChunkBytes - overlap;
        byte[] buffer = new byte[ScanChunkBytes];

        for (int offset = 0; offset < size; offset += step)
        {
            int requested = Math.Min(ScanChunkBytes, size - offset);
            int bytesRead;
            if (!memory.TryRead(start + offset, buffer, requested, out bytesRead)) continue;
            int limit = bytesRead - pattern.Count;
            for (int index = 0; index <= limit; index++)
            {
                bool matches = true;
                for (int patternIndex = 0; patternIndex < pattern.Count; patternIndex++)
                {
                    byte? expected = pattern[patternIndex];
                    if (expected.HasValue && buffer[index + patternIndex] != expected.Value)
                    {
                        matches = false;
                        break;
                    }
                }
                if (!matches) continue;
                long address = start + offset + index;
                if (address == found) continue;
                found = address;
                foundCount++;
                if (foundCount > 1) throw new HelperFailure("PATTERN_NOT_UNIQUE", patternName);
            }
        }

        if (foundCount == 0) throw new HelperFailure("PATTERN_NOT_FOUND", patternName);
        return found;
    }

    private static void WriteResult(string state, string code, string detail)
    {
        string safeDetail = (detail ?? "").Replace('\t', ' ').Replace('\r', ' ').Replace('\n', ' ');
        Console.WriteLine("EROVERLY_RESULT\t" + state + "\t" + code + "\t" + safeDetail);
    }

    private static void WriteBossState(string id, bool dead)
    {
        string safeId = (id ?? "").Replace('\t', '_').Replace('\r', '_').Replace('\n', '_');
        Console.WriteLine("EROVERLY_BOSS_STATE\t" + safeId + "\t" + (dead ? "1" : "0"));
    }

    private static void WriteInvincibilityState(string key, bool enabled)
    {
        string safeKey = (key ?? "").Replace('\t', '_').Replace('\r', '_').Replace('\n', '_');
        Console.WriteLine("EROVERLY_INVINCIBILITY_STATE\t" + safeKey + "\t" + (enabled ? "1" : "0"));
    }

    private static void WriteCharacterStat(string key, int value)
    {
        string safeKey = (key ?? "").Replace('\t', '_').Replace('\r', '_').Replace('\n', '_');
        Console.WriteLine("EROVERLY_CHARACTER_STAT\t" + safeKey + "\t" + value.ToString(CultureInfo.InvariantCulture));
    }
}
