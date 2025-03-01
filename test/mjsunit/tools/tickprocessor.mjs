// Copyright 2009 the V8 project authors. All rights reserved.
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Google Inc. nor the names of its
//       contributors may be used to endorse or promote products derived
//       from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// Resources: test/mjsunit/tools/tickprocessor-test-func-info.log
// Resources: test/mjsunit/tools/tickprocessor-test.default
// Resources: test/mjsunit/tools/tickprocessor-test.func-info
// Resources: test/mjsunit/tools/tickprocessor-test.gc-state
// Resources: test/mjsunit/tools/tickprocessor-test.ignore-unknown
// Resources: test/mjsunit/tools/tickprocessor-test.log
// Resources: test/mjsunit/tools/tickprocessor-test.only-summary
// Resources: test/mjsunit/tools/tickprocessor-test.separate-ic
// Env: TEST_FILE_NAME

import {
  TickProcessor, ArgumentsProcessor, UnixCppEntriesProvider,
  MacCppEntriesProvider, WindowsCppEntriesProvider, readFile
} from "../../../tools/tickprocessor.mjs";


(function testArgumentsProcessor() {
  var p_default = new ArgumentsProcessor([]);
  assertTrue(p_default.parse());
  assertEquals(p_default.getDefaultResults(), p_default.result());

  var p_logFile = new ArgumentsProcessor(['logfile.log']);
  assertTrue(p_logFile.parse());
  assertEquals('logfile.log', p_logFile.result().logFileName);

  var p_platformAndLog = new ArgumentsProcessor(['--windows', 'winlog.log']);
  assertTrue(p_platformAndLog.parse());
  assertEquals('windows', p_platformAndLog.result().platform);
  assertEquals('winlog.log', p_platformAndLog.result().logFileName);

  var p_flags = new ArgumentsProcessor(['--gc', '--separate-ic=true']);
  assertTrue(p_flags.parse());
  assertEquals(TickProcessor.VmStates.GC, p_flags.result().stateFilter);
  assertTrue(p_flags.result().separateIc);

  var p_flags = new ArgumentsProcessor(['--gc', '--separate-ic=false']);
  assertTrue(p_flags.parse());
  assertEquals(TickProcessor.VmStates.GC, p_flags.result().stateFilter);
  assertFalse(p_flags.result().separateIc);

  var p_nmAndLog = new ArgumentsProcessor(['--nm=mn', 'nmlog.log']);
  assertTrue(p_nmAndLog.parse());
  assertEquals('mn', p_nmAndLog.result().nm);
  assertEquals('nmlog.log', p_nmAndLog.result().logFileName);

  var p_bad = new ArgumentsProcessor(['--unknown', 'badlog.log']);
  assertFalse(p_bad.parse());
})();


(function testUnixCppEntriesProvider() {
  var oldLoadSymbols = UnixCppEntriesProvider.prototype.loadSymbols;

  // shell executable
  UnixCppEntriesProvider.prototype.loadSymbols = function(libName) {
    this.symbols = [[
      '         U operator delete[](void*)@@GLIBCXX_3.4',
      '08049790 T _init',
      '08049f50 T _start',
      '08139150 00000b4b t v8::internal::Runtime_StringReplaceRegExpWithString(v8::internal::Arguments)',
      '08139ca0 000003f1 T v8::internal::Runtime::GetElementOrCharAt(v8::internal::Handle<v8::internal::Object>, unsigned int)',
      '0813a0b0 00000855 t v8::internal::Runtime_DebugGetPropertyDetails(v8::internal::Arguments)',
      '0818b220 00000036 W v8::internal::RegExpMacroAssembler::CheckPosition(int, v8::internal::Label*)',
      '         w __gmon_start__',
      '081f08a0 00000004 B stdout\n'
    ].join('\n'), ''];
  };

  var shell_prov = new UnixCppEntriesProvider();
  var shell_syms = [];
  shell_prov.parseVmSymbols('shell', 0x08048000, 0x081ee000, 0,
      function (name, start, end) {
        shell_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  assertEquals(
      [['_init', 0x08049790, 0x08049f50],
       ['_start', 0x08049f50, 0x08139150],
       ['v8::internal::Runtime_StringReplaceRegExpWithString(v8::internal::Arguments)', 0x08139150, 0x08139150 + 0xb4b],
       ['v8::internal::Runtime::GetElementOrCharAt(v8::internal::Handle<v8::internal::Object>, unsigned int)', 0x08139ca0, 0x08139ca0 + 0x3f1],
       ['v8::internal::Runtime_DebugGetPropertyDetails(v8::internal::Arguments)', 0x0813a0b0, 0x0813a0b0 + 0x855],
       ['v8::internal::RegExpMacroAssembler::CheckPosition(int, v8::internal::Label*)', 0x0818b220, 0x0818b220 + 0x36]],
      shell_syms);

  // libc library
  UnixCppEntriesProvider.prototype.loadSymbols = function(libName) {
    this.symbols = [[
        '000162a0 00000005 T __libc_init_first',
        '0002a5f0 0000002d T __isnan',
        '0002a5f0 0000002d W isnan',
        '0002aaa0 0000000d W scalblnf',
        '0002aaa0 0000000d W scalbnf',
        '0011a340 00000048 T __libc_thread_freeres',
        '00128860 00000024 R _itoa_lower_digits\n'].join('\n'), ''];
  };
  var libc_prov = new UnixCppEntriesProvider();
  var libc_syms = [];
  libc_prov.parseVmSymbols('libc', 0xf7c5c000, 0xf7da5000, 0,
      function (name, start, end) {
        libc_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  var libc_ref_syms = [['__libc_init_first', 0x000162a0, 0x000162a0 + 0x5],
       ['__isnan', 0x0002a5f0, 0x0002a5f0 + 0x2d],
       ['scalblnf', 0x0002aaa0, 0x0002aaa0 + 0xd],
       ['__libc_thread_freeres', 0x0011a340, 0x0011a340 + 0x48]];
  for (var i = 0; i < libc_ref_syms.length; ++i) {
    libc_ref_syms[i][1] += 0xf7c5c000;
    libc_ref_syms[i][2] += 0xf7c5c000;
  }
  assertEquals(libc_ref_syms, libc_syms);

  // Android library with zero length duplicates.
  UnixCppEntriesProvider.prototype.loadSymbols = function(libName) {
    this.symbols = [[
      '00000000013a1088 0000000000000224 t v8::internal::interpreter::BytecodeGenerator::BytecodeGenerator(v8::internal::UnoptimizedCompilationInfo*)',
      '00000000013a1088 0000000000000224 t v8::internal::interpreter::BytecodeGenerator::BytecodeGenerator(v8::internal::UnoptimizedCompilationInfo*)',
      '00000000013a12ac t $x.4',
      '00000000013a12ac 00000000000000d0 t v8::internal::interpreter::BytecodeGenerator::FinalizeBytecode(v8::internal::Isolate*, v8::internal::Handle<v8::internal::Script>)',
      '00000000013a137c t $x.5',
      '00000000013a137c 0000000000000528 t v8::internal::interpreter::BytecodeGenerator::AllocateDeferredConstants(v8::internal::Isolate*, v8::internal::Handle<v8::internal::Script>)',
      '00000000013a1578 N $d.46',
      '00000000013a18a4 t $x.6',
      '00000000013a18a4 0000000000000 t v8::internal::interpreter::BytecodeGenerator::GlobalDeclarationsBuilder::AllocateDeclarations(v8::internal::UnoptimizedCompilationInfo*, v8::internal::Handle<v8::internal::Script>, v8::internal::Isolate*)',
      '00000000013a19e0 t $x.7',
      '00000000013a19e0 0000000000000244 t v8::internal::interpreter::BytecodeGenerator::GenerateBytecode(unsigned long)',
      '00000000013a1a88 N $d.7',
      '00000000013a1ac8 N $d.5',
      '00000000013a1af8 N $d.35',
      '00000000013a1c24 t $x.8',
      '00000000013a1c24 000000000000009c t v8::internal::interpreter::BytecodeGenerator::ContextScope::ContextScope(v8::internal::interpreter::BytecodeGenerator*, v8::internal::Scope*)\n',
    ].join('\n'), ''];
  };
  var android_prov = new UnixCppEntriesProvider();
  var android_syms = [];
  android_prov.parseVmSymbols('libmonochrome', 0xf7c5c000, 0xf9c5c000, 0,
      function (name, start, end) {
        android_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  var android_ref_syms = [
       ['v8::internal::interpreter::BytecodeGenerator::BytecodeGenerator(v8::internal::UnoptimizedCompilationInfo*)', 0x013a1088, 0x013a1088 + 0x224],
       ['v8::internal::interpreter::BytecodeGenerator::FinalizeBytecode(v8::internal::Isolate*, v8::internal::Handle<v8::internal::Script>)', 0x013a12ac, 0x013a12ac + 0xd0],
       ['v8::internal::interpreter::BytecodeGenerator::AllocateDeferredConstants(v8::internal::Isolate*, v8::internal::Handle<v8::internal::Script>)', 0x013a137c, 0x013a137c + 0x528],
       ['v8::internal::interpreter::BytecodeGenerator::GlobalDeclarationsBuilder::AllocateDeclarations(v8::internal::UnoptimizedCompilationInfo*, v8::internal::Handle<v8::internal::Script>, v8::internal::Isolate*)', 0x013a18a4, 0x013a18a4 + 0x13c],
       ['v8::internal::interpreter::BytecodeGenerator::GenerateBytecode(unsigned long)', 0x013a19e0, 0x013a19e0 + 0x244],
       ['v8::internal::interpreter::BytecodeGenerator::ContextScope::ContextScope(v8::internal::interpreter::BytecodeGenerator*, v8::internal::Scope*)', 0x013a1c24, 0x013a1c24 + 0x9c],
  ];
  for (var i = 0; i < android_ref_syms.length; ++i) {
    android_ref_syms[i][1] += 0xf7c5c000;
    android_ref_syms[i][2] += 0xf7c5c000;
  }
  assertEquals(android_ref_syms, android_syms);

  UnixCppEntriesProvider.prototype.loadSymbols = oldLoadSymbols;
})();


(function testMacCppEntriesProvider() {
  var oldLoadSymbols = MacCppEntriesProvider.prototype.loadSymbols;

  // shell executable
  MacCppEntriesProvider.prototype.loadSymbols = function(libName) {
    this.symbols = [[
      '         operator delete[]',
      '00001000 __mh_execute_header',
      '00001b00 start',
      '00001b40 dyld_stub_binding_helper',
      '0011b710 v8::internal::RegExpMacroAssembler::CheckPosition',
      '00134250 v8::internal::Runtime_StringReplaceRegExpWithString',
      '00137220 v8::internal::Runtime::GetElementOrCharAt',
      '00137400 v8::internal::Runtime_DebugGetPropertyDetails\n'
    ].join('\n'), ''];
  };

  var shell_prov = new MacCppEntriesProvider();
  var shell_syms = [];
  shell_prov.parseVmSymbols('shell', 0x00001c00, 0x00163256, 0x100,
      function (name, start, end) {
        shell_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  assertEquals(
      [['start', 0x00001c00, 0x00001c40],
       ['dyld_stub_binding_helper', 0x00001c40, 0x0011b810],
       ['v8::internal::RegExpMacroAssembler::CheckPosition', 0x0011b810, 0x00134350],
       ['v8::internal::Runtime_StringReplaceRegExpWithString', 0x00134350, 0x00137320],
       ['v8::internal::Runtime::GetElementOrCharAt', 0x00137320, 0x00137500],
       ['v8::internal::Runtime_DebugGetPropertyDetails', 0x00137500, 0x00163256]],
      shell_syms);

  // stdc++ library
  MacCppEntriesProvider.prototype.loadSymbols = function(libName) {
    this.symbols = [[
        '0000107a __gnu_cxx::balloc::__mini_vector<std::pair<__gnu_cxx::bitmap_allocator<char>::_Alloc_block*, __gnu_cxx::bitmap_allocator<char>::_Alloc_block*> >::__mini_vector',
        '0002c410 std::basic_streambuf<char, std::char_traits<char> >::pubseekoff',
        '0002c488 std::basic_streambuf<char, std::char_traits<char> >::pubseekpos',
        '000466aa ___cxa_pure_virtual\n'].join('\n'), ''];
  };
  var stdc_prov = new MacCppEntriesProvider();
  var stdc_syms = [];
  stdc_prov.parseVmSymbols('stdc++', 0x95728fb4, 0x95770005, 0,
      function (name, start, end) {
        stdc_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  var stdc_ref_syms = [['__gnu_cxx::balloc::__mini_vector<std::pair<__gnu_cxx::bitmap_allocator<char>::_Alloc_block*, __gnu_cxx::bitmap_allocator<char>::_Alloc_block*> >::__mini_vector', 0x0000107a, 0x0002c410],
       ['std::basic_streambuf<char, std::char_traits<char> >::pubseekoff', 0x0002c410, 0x0002c488],
       ['std::basic_streambuf<char, std::char_traits<char> >::pubseekpos', 0x0002c488, 0x000466aa],
       ['___cxa_pure_virtual', 0x000466aa, 0x95770005 - 0x95728fb4]];
  for (var i = 0; i < stdc_ref_syms.length; ++i) {
    stdc_ref_syms[i][1] += 0x95728fb4;
    stdc_ref_syms[i][2] += 0x95728fb4;
  }
  assertEquals(stdc_ref_syms, stdc_syms);

  MacCppEntriesProvider.prototype.loadSymbols = oldLoadSymbols;
})();


(function testWindowsCppEntriesProvider() {
  var oldLoadSymbols = WindowsCppEntriesProvider.prototype.loadSymbols;

  WindowsCppEntriesProvider.prototype.loadSymbols = function(libName) {
    this.symbols = [
      ' Start         Length     Name                   Class',
      ' 0001:00000000 000ac902H .text                   CODE',
      ' 0001:000ac910 000005e2H .text$yc                CODE',
      '  Address         Publics by Value              Rva+Base       Lib:Object',
      ' 0000:00000000       __except_list              00000000     <absolute>',
      ' 0001:00000000       ?ReadFile@@YA?AV?$Handle@VString@v8@@@v8@@PBD@Z 00401000 f   shell.obj',
      ' 0001:000000a0       ?Print@@YA?AV?$Handle@VValue@v8@@@v8@@ABVArguments@2@@Z 004010a0 f   shell.obj',
      ' 0001:00001230       ??1UTF8Buffer@internal@v8@@QAE@XZ 00402230 f   v8_snapshot:scanner.obj',
      ' 0001:00001230       ??1Utf8Value@String@v8@@QAE@XZ 00402230 f   v8_snapshot:api.obj',
      ' 0001:000954ba       __fclose_nolock            004964ba f   LIBCMT:fclose.obj',
      ' 0002:00000000       __imp__SetThreadPriority@8 004af000     kernel32:KERNEL32.dll',
      ' 0003:00000418       ?in_use_list_@PreallocatedStorage@internal@v8@@0V123@A 00544418     v8_snapshot:allocation.obj',
      ' Static symbols',
      ' 0001:00000b70       ?DefaultFatalErrorHandler@v8@@YAXPBD0@Z 00401b70 f   v8_snapshot:api.obj',
      ' 0001:000010b0       ?EnsureInitialized@v8@@YAXPBD@Z 004020b0 f   v8_snapshot:api.obj',
      ' 0001:000ad17b       ??__Fnomem@?5???2@YAPAXI@Z@YAXXZ 004ae17b f   LIBCMT:new.obj'
    ].join('\r\n');
  };
  var shell_prov = new WindowsCppEntriesProvider();
  var shell_syms = [];
  shell_prov.parseVmSymbols('shell.exe', 0x00400000, 0x0057c000, 0,
      function (name, start, end) {
        shell_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  assertEquals(
      [['ReadFile', 0x00401000, 0x004010a0],
       ['Print', 0x004010a0, 0x00402230],
       ['v8::String::?1Utf8Value', 0x00402230, 0x004964ba],
       ['v8::DefaultFatalErrorHandler', 0x00401b70, 0x004020b0],
       ['v8::EnsureInitialized', 0x004020b0, 0x0057c000]],
      shell_syms);

  WindowsCppEntriesProvider.prototype.loadSymbols = oldLoadSymbols;
})();


// http://code.google.com/p/v8/issues/detail?id=427
(function testWindowsProcessExeAndDllMapFile() {
  function exeSymbols(exeName) {
    return [
      ' 0000:00000000       ___ImageBase               00400000     <linker-defined>',
      ' 0001:00000780       ?RunMain@@YAHHQAPAD@Z      00401780 f   shell.obj',
      ' 0001:00000ac0       _main                      00401ac0 f   shell.obj',
      ''
    ].join('\r\n');
  }

  function dllSymbols(dllName) {
    return [
      ' 0000:00000000       ___ImageBase               01c30000     <linker-defined>',
      ' 0001:00000780       _DllMain@12                01c31780 f   libcmt:dllmain.obj',
      ' 0001:00000ac0       ___DllMainCRTStartup       01c31ac0 f   libcmt:dllcrt0.obj',
      ''
    ].join('\r\n');
  }

  var oldRead = read;

  read = exeSymbols;
  var exe_exe_syms = [];
  (new WindowsCppEntriesProvider()).parseVmSymbols(
      'chrome.exe', 0x00400000, 0x00472000, 0,
      function (name, start, end) {
        exe_exe_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  assertEquals(
      [['RunMain', 0x00401780, 0x00401ac0],
       ['_main', 0x00401ac0, 0x00472000]],
      exe_exe_syms, '.exe with .exe symbols');

  read = dllSymbols;
  var exe_dll_syms = [];
  (new WindowsCppEntriesProvider()).parseVmSymbols(
      'chrome.exe', 0x00400000, 0x00472000, 0,
      function (name, start, end) {
        exe_dll_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  assertEquals(
      [],
      exe_dll_syms, '.exe with .dll symbols');

  read = dllSymbols;
  var dll_dll_syms = [];
  (new WindowsCppEntriesProvider()).parseVmSymbols(
      'chrome.dll', 0x01c30000, 0x02b80000, 0,
      function (name, start, end) {
        dll_dll_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  assertEquals(
      [['_DllMain@12', 0x01c31780, 0x01c31ac0],
       ['___DllMainCRTStartup', 0x01c31ac0, 0x02b80000]],
      dll_dll_syms, '.dll with .dll symbols');

  read = exeSymbols;
  var dll_exe_syms = [];
  (new WindowsCppEntriesProvider()).parseVmSymbols(
      'chrome.dll', 0x01c30000, 0x02b80000, 0,
      function (name, start, end) {
        dll_exe_syms.push(Array.prototype.slice.apply(arguments, [0]));
      });
  assertEquals(
      [],
      dll_exe_syms, '.dll with .exe symbols');

  read = oldRead;
})();


class CppEntriesProviderMock {
  constructor(filename) {
    this.isLoaded = false;
    this.symbols = JSON.parse(readFile(filename));
  }
  parseVmSymbols(name, startAddr, endAddr, slideAddr, symbolAdder) {
    if (this.isLoaded) return;
    this.isLoaded = true;
    for (let symbol of this.symbols) {
      symbolAdder.apply(null, symbol);
    }
  }
}


class PrintMonitor {
  constructor(outputOrFileName) {
    this.expectedOut = outputOrFileName;
    this.outputFile = undefined;
    if (typeof outputOrFileName == 'string') {
      this.expectedOut = this.loadExpectedOutput(outputOrFileName)
      this.outputFile = outputOrFileName;
    }
    var expectedOut = this.expectedOut;
    var outputPos = 0;
    var diffs = this.diffs = [];
    var realOut = this.realOut = [];
    var unexpectedOut = this.unexpectedOut = null;

    this.oldPrint = print;
    print = function(str) {
      var strSplit = str.split('\n');
      for (var i = 0; i < strSplit.length; ++i) {
        var s = strSplit[i];
        realOut.push(s);
        if (outputPos < expectedOut.length) {
          if (expectedOut[outputPos] != s) {
            diffs.push('line ' + outputPos + ': expected <' +
                      expectedOut[outputPos] + '> found <' + s + '>\n');
          }
          outputPos++;
        } else {
          unexpectedOut = true;
        }
      }
    };
  }

  loadExpectedOutput(fileName) {
    var output = readFile(fileName);
    return output.split('\n');
  }

 finish() {
    print = this.oldPrint;
    if (this.diffs.length > 0 || this.unexpectedOut != null) {
      console.log("===== actual output: =====");
      console.log(this.realOut.join('\n'));
      console.log("===== expected output: =====");
      if (this.outputFile) {
        console.log("===== File: " + this.outputFile + " =====");
      }
      console.log(this.expectedOut.join('\n'));
      if (this.diffs.length > 0) {
        this.diffs.forEach(line => console.log(line))
        assertEquals([], this.diffs);
      }
      assertNull(this.unexpectedOut);
    }
  }
}


function driveTickProcessorTest(
    separateIc, separateBytecodes, separateBuiltins, separateStubs,
    separateBaselineHandlers, ignoreUnknown, stateFilter, logInput,
    refOutput, onlySummary) {
  // TEST_FILE_NAME must be provided by test runner.
  assertEquals('string', typeof TEST_FILE_NAME);
  var pathLen = TEST_FILE_NAME.lastIndexOf('/');
  if (pathLen == -1) {
    pathLen = TEST_FILE_NAME.lastIndexOf('\\');
  }
  assertTrue(pathLen != -1);
  const testsPath = TEST_FILE_NAME.substr(0, pathLen + 1);
  const symbolsFile = testsPath + logInput + '.symbols.json';
  const tp = new TickProcessor(new CppEntriesProviderMock(symbolsFile),
                             separateIc,
                             separateBytecodes,
                             separateBuiltins,
                             separateStubs,
                             separateBaselineHandlers,
                             TickProcessor.CALL_GRAPH_SIZE,
                             ignoreUnknown,
                             stateFilter,
                             "0",
                             "auto,auto",
                             null,
                             false,
                             false,
                             onlySummary);
  const pm = new PrintMonitor(testsPath + refOutput);
  tp.processLogFileInTest(testsPath + logInput);
  tp.printStatistics();
  pm.finish();
};


(function testProcessing() {
  var testData = {
    'Default': [
      false, false, true, true, false, false, null,
      'tickprocessor-test.log', 'tickprocessor-test.default', false],
    'SeparateBytecodes': [
      false, true, true, true, false, false, null,
      'tickprocessor-test.log', 'tickprocessor-test.separate-bytecodes', false],
    'SeparateBaselineHandlers': [
      false, false, true, true, true, false, null,
      'tickprocessor-test.log', 'tickprocessor-test.separate-baseline-handlers', false],
    'SeparateIc': [
      true, false, true, true, false, false, null,
      'tickprocessor-test.log', 'tickprocessor-test.separate-ic', false],
    'IgnoreUnknown': [
      false, false, true, true, false, true, null,
      'tickprocessor-test.log', 'tickprocessor-test.ignore-unknown', false],
    'GcState': [
      false, false, true, true, false, false, TickProcessor.VmStates.GC,
      'tickprocessor-test.log', 'tickprocessor-test.gc-state', false],
    'OnlySummary': [
      false, false, true, true, false, false, null,
      'tickprocessor-test.log', 'tickprocessor-test.only-summary', true],
    'FunctionInfo': [
      false, false, true, true, false, false, null,
      'tickprocessor-test-func-info.log', 'tickprocessor-test.func-info',
      false],
    'DefaultLarge': [
      false, false, true, true, false, false, null,
      'tickprocessor-test-large.log', 'tickprocessor-test-large.default', false],
  };
  for (var testName in testData) {
    console.log('=== testProcessing-' + testName + ' ===');
    driveTickProcessorTest(...testData[testName]);
  }
})();
