// Copyright 2014 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "src/ic/call-optimization.h"
#include "src/objects/objects-inl.h"

namespace v8 {
namespace internal {

CallOptimization::CallOptimization(Isolate* isolate, Handle<Object> function) {
  constant_function_ = Handle<JSFunction>::null();
  is_simple_api_call_ = false;
  accept_any_receiver_ = false;
  expected_receiver_type_ = Handle<FunctionTemplateInfo>::null();
  api_call_info_ = Handle<CallHandlerInfo>::null();
  if (function->IsJSFunction()) {
    Initialize(isolate, Handle<JSFunction>::cast(function));
  } else if (function->IsFunctionTemplateInfo()) {
    Initialize(isolate, Handle<FunctionTemplateInfo>::cast(function));
  }
}

Context CallOptimization::GetAccessorContext(Map holder_map) const {
  if (is_constant_call()) {
    return constant_function_->context().native_context();
  }
  JSFunction constructor = JSFunction::cast(holder_map.GetConstructor());
  return constructor.context().native_context();
}

bool CallOptimization::IsCrossContextLazyAccessorPair(Context native_context,
                                                      Map holder_map) const {
  DCHECK(native_context.IsNativeContext());
  if (is_constant_call()) return false;
  return native_context != GetAccessorContext(holder_map);
}

Handle<JSObject> CallOptimization::LookupHolderOfExpectedType(
    Handle<Map> object_map, HolderLookup* holder_lookup) const {
  DCHECK(is_simple_api_call());
  if (!object_map->IsJSObjectMap()) {
    *holder_lookup = kHolderNotFound;
    return Handle<JSObject>::null();
  }
  if (expected_receiver_type_.is_null() ||
      expected_receiver_type_->IsTemplateFor(*object_map)) {
    *holder_lookup = kHolderIsReceiver;
    return Handle<JSObject>::null();
  }
  if (object_map->IsJSGlobalProxyMap() && !object_map->prototype().IsNull()) {
    JSObject raw_prototype = JSObject::cast(object_map->prototype());
    Handle<JSObject> prototype(raw_prototype, raw_prototype.GetIsolate());
    object_map = handle(prototype->map(), prototype->GetIsolate());
    if (expected_receiver_type_->IsTemplateFor(*object_map)) {
      *holder_lookup = kHolderFound;
      return prototype;
    }
  }
  *holder_lookup = kHolderNotFound;
  return Handle<JSObject>::null();
}

bool CallOptimization::IsCompatibleReceiverMap(
    Handle<JSObject> api_holder, Handle<JSObject> holder,
    HolderLookup holder_lookup) const {
  DCHECK(is_simple_api_call());
  switch (holder_lookup) {
    case kHolderNotFound:
      return false;
    case kHolderIsReceiver:
      return true;
    case kHolderFound:
      if (api_holder.is_identical_to(holder)) return true;
      // Check if holder is in prototype chain of api_holder.
      {
        JSObject object = *api_holder;
        while (true) {
          Object prototype = object.map().prototype();
          if (!prototype.IsJSObject()) return false;
          if (prototype == *holder) return true;
          object = JSObject::cast(prototype);
        }
      }
      break;
  }
  UNREACHABLE();
}

void CallOptimization::Initialize(
    Isolate* isolate, Handle<FunctionTemplateInfo> function_template_info) {
  HeapObject call_code = function_template_info->call_code(kAcquireLoad);
  if (call_code.IsUndefined(isolate)) return;
  api_call_info_ = handle(CallHandlerInfo::cast(call_code), isolate);

  HeapObject signature = function_template_info->signature();
  if (!signature.IsUndefined(isolate)) {
    expected_receiver_type_ =
        handle(FunctionTemplateInfo::cast(signature), isolate);
  }
  is_simple_api_call_ = true;
  accept_any_receiver_ = function_template_info->accept_any_receiver();
}

void CallOptimization::Initialize(Isolate* isolate,
                                  Handle<JSFunction> function) {
  if (function.is_null() || !function->is_compiled()) return;

  constant_function_ = function;
  AnalyzePossibleApiFunction(isolate, function);
}

void CallOptimization::AnalyzePossibleApiFunction(Isolate* isolate,
                                                  Handle<JSFunction> function) {
  if (!function->shared().IsApiFunction()) return;
  Handle<FunctionTemplateInfo> info(function->shared().get_api_func_data(),
                                    isolate);

  // Require a C++ callback.
  HeapObject call_code = info->call_code(kAcquireLoad);
  if (call_code.IsUndefined(isolate)) return;
  api_call_info_ = handle(CallHandlerInfo::cast(call_code), isolate);

  if (!info->signature().IsUndefined(isolate)) {
    expected_receiver_type_ =
        handle(FunctionTemplateInfo::cast(info->signature()), isolate);
  }

  is_simple_api_call_ = true;
  accept_any_receiver_ = info->accept_any_receiver();
}
}  // namespace internal
}  // namespace v8
