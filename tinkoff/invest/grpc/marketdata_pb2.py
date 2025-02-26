# -*- coding: utf-8 -*-
# Generated by the protocol buffer compiler.  DO NOT EDIT!
# NO CHECKED-IN PROTOBUF GENCODE
# source: tinkoff/invest/grpc/marketdata.proto
# Protobuf Python Version: 5.29.0
"""Generated protocol buffer code."""
from google.protobuf import descriptor as _descriptor
from google.protobuf import descriptor_pool as _descriptor_pool
from google.protobuf import runtime_version as _runtime_version
from google.protobuf import symbol_database as _symbol_database
from google.protobuf.internal import builder as _builder
_runtime_version.ValidateProtobufRuntimeVersion(
    _runtime_version.Domain.PUBLIC,
    5,
    29,
    0,
    '',
    'tinkoff/invest/grpc/marketdata.proto'
)
# @@protoc_insertion_point(imports)

_sym_db = _symbol_database.Default()


from google.protobuf import timestamp_pb2 as google_dot_protobuf_dot_timestamp__pb2
from tinkoff.invest.grpc import common_pb2 as tinkoff_dot_invest_dot_grpc_dot_common__pb2


DESCRIPTOR = _descriptor_pool.Default().AddSerializedFile(b'\n$tinkoff/invest/grpc/marketdata.proto\x12%tinkoff.public.invest.api.contract.v1\x1a\x1fgoogle/protobuf/timestamp.proto\x1a tinkoff/invest/grpc/common.proto\"\xf4\x04\n\x11MarketDataRequest\x12\x63\n\x19subscribe_candles_request\x18\x01 \x01(\x0b\x32>.tinkoff.public.invest.api.contract.v1.SubscribeCandlesRequestH\x00\x12h\n\x1csubscribe_order_book_request\x18\x02 \x01(\x0b\x32@.tinkoff.public.invest.api.contract.v1.SubscribeOrderBookRequestH\x00\x12\x61\n\x18subscribe_trades_request\x18\x03 \x01(\x0b\x32=.tinkoff.public.invest.api.contract.v1.SubscribeTradesRequestH\x00\x12]\n\x16subscribe_info_request\x18\x04 \x01(\x0b\x32;.tinkoff.public.invest.api.contract.v1.SubscribeInfoRequestH\x00\x12h\n\x1csubscribe_last_price_request\x18\x05 \x01(\x0b\x32@.tinkoff.public.invest.api.contract.v1.SubscribeLastPriceRequestH\x00\x12Y\n\x14get_my_subscriptions\x18\x06 \x01(\x0b\x32\x39.tinkoff.public.invest.api.contract.v1.GetMySubscriptionsH\x00\x42\t\n\x07payload\"\x94\x04\n!MarketDataServerSideStreamRequest\x12\x61\n\x19subscribe_candles_request\x18\x01 \x01(\x0b\x32>.tinkoff.public.invest.api.contract.v1.SubscribeCandlesRequest\x12\x66\n\x1csubscribe_order_book_request\x18\x02 \x01(\x0b\x32@.tinkoff.public.invest.api.contract.v1.SubscribeOrderBookRequest\x12_\n\x18subscribe_trades_request\x18\x03 \x01(\x0b\x32=.tinkoff.public.invest.api.contract.v1.SubscribeTradesRequest\x12[\n\x16subscribe_info_request\x18\x04 \x01(\x0b\x32;.tinkoff.public.invest.api.contract.v1.SubscribeInfoRequest\x12\x66\n\x1csubscribe_last_price_request\x18\x05 \x01(\x0b\x32@.tinkoff.public.invest.api.contract.v1.SubscribeLastPriceRequest\"\xc0\x07\n\x12MarketDataResponse\x12\x65\n\x1asubscribe_candles_response\x18\x01 \x01(\x0b\x32?.tinkoff.public.invest.api.contract.v1.SubscribeCandlesResponseH\x00\x12j\n\x1dsubscribe_order_book_response\x18\x02 \x01(\x0b\x32\x41.tinkoff.public.invest.api.contract.v1.SubscribeOrderBookResponseH\x00\x12\x63\n\x19subscribe_trades_response\x18\x03 \x01(\x0b\x32>.tinkoff.public.invest.api.contract.v1.SubscribeTradesResponseH\x00\x12_\n\x17subscribe_info_response\x18\x04 \x01(\x0b\x32<.tinkoff.public.invest.api.contract.v1.SubscribeInfoResponseH\x00\x12?\n\x06\x63\x61ndle\x18\x05 \x01(\x0b\x32-.tinkoff.public.invest.api.contract.v1.CandleH\x00\x12=\n\x05trade\x18\x06 \x01(\x0b\x32,.tinkoff.public.invest.api.contract.v1.TradeH\x00\x12\x45\n\torderbook\x18\x07 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.OrderBookH\x00\x12N\n\x0etrading_status\x18\x08 \x01(\x0b\x32\x34.tinkoff.public.invest.api.contract.v1.TradingStatusH\x00\x12;\n\x04ping\x18\t \x01(\x0b\x32+.tinkoff.public.invest.api.contract.v1.PingH\x00\x12j\n\x1dsubscribe_last_price_response\x18\n \x01(\x0b\x32\x41.tinkoff.public.invest.api.contract.v1.SubscribeLastPriceResponseH\x00\x12\x46\n\nlast_price\x18\x0b \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.LastPriceH\x00\x42\t\n\x07payload\"\xd6\x01\n\x17SubscribeCandlesRequest\x12V\n\x13subscription_action\x18\x01 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionAction\x12L\n\x0binstruments\x18\x02 \x03(\x0b\x32\x37.tinkoff.public.invest.api.contract.v1.CandleInstrument\x12\x15\n\rwaiting_close\x18\x03 \x01(\x08\"\x8a\x01\n\x10\x43\x61ndleInstrument\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12M\n\x08interval\x18\x02 \x01(\x0e\x32;.tinkoff.public.invest.api.contract.v1.SubscriptionInterval\x12\x15\n\rinstrument_id\x18\x03 \x01(\t\"\x89\x01\n\x18SubscribeCandlesResponse\x12\x13\n\x0btracking_id\x18\x01 \x01(\t\x12X\n\x15\x63\x61ndles_subscriptions\x18\x02 \x03(\x0b\x32\x39.tinkoff.public.invest.api.contract.v1.CandleSubscription\"\xe1\x01\n\x12\x43\x61ndleSubscription\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12M\n\x08interval\x18\x02 \x01(\x0e\x32;.tinkoff.public.invest.api.contract.v1.SubscriptionInterval\x12V\n\x13subscription_status\x18\x03 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionStatus\x12\x16\n\x0einstrument_uid\x18\x04 \x01(\t\"\xc4\x01\n\x19SubscribeOrderBookRequest\x12V\n\x13subscription_action\x18\x01 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionAction\x12O\n\x0binstruments\x18\x02 \x03(\x0b\x32:.tinkoff.public.invest.api.contract.v1.OrderBookInstrument\"M\n\x13OrderBookInstrument\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12\r\n\x05\x64\x65pth\x18\x02 \x01(\x05\x12\x15\n\rinstrument_id\x18\x03 \x01(\t\"\x91\x01\n\x1aSubscribeOrderBookResponse\x12\x13\n\x0btracking_id\x18\x01 \x01(\t\x12^\n\x18order_book_subscriptions\x18\x02 \x03(\x0b\x32<.tinkoff.public.invest.api.contract.v1.OrderBookSubscription\"\xa4\x01\n\x15OrderBookSubscription\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12\r\n\x05\x64\x65pth\x18\x02 \x01(\x05\x12V\n\x13subscription_status\x18\x03 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionStatus\x12\x16\n\x0einstrument_uid\x18\x04 \x01(\t\"\xbd\x01\n\x16SubscribeTradesRequest\x12V\n\x13subscription_action\x18\x01 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionAction\x12K\n\x0binstruments\x18\x02 \x03(\x0b\x32\x36.tinkoff.public.invest.api.contract.v1.TradeInstrument\":\n\x0fTradeInstrument\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12\x15\n\rinstrument_id\x18\x02 \x01(\t\"\x85\x01\n\x17SubscribeTradesResponse\x12\x13\n\x0btracking_id\x18\x01 \x01(\t\x12U\n\x13trade_subscriptions\x18\x02 \x03(\x0b\x32\x38.tinkoff.public.invest.api.contract.v1.TradeSubscription\"\x91\x01\n\x11TradeSubscription\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12V\n\x13subscription_status\x18\x02 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionStatus\x12\x16\n\x0einstrument_uid\x18\x03 \x01(\t\"\xba\x01\n\x14SubscribeInfoRequest\x12V\n\x13subscription_action\x18\x01 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionAction\x12J\n\x0binstruments\x18\x02 \x03(\x0b\x32\x35.tinkoff.public.invest.api.contract.v1.InfoInstrument\"9\n\x0eInfoInstrument\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12\x15\n\rinstrument_id\x18\x02 \x01(\t\"\x81\x01\n\x15SubscribeInfoResponse\x12\x13\n\x0btracking_id\x18\x01 \x01(\t\x12S\n\x12info_subscriptions\x18\x02 \x03(\x0b\x32\x37.tinkoff.public.invest.api.contract.v1.InfoSubscription\"\x90\x01\n\x10InfoSubscription\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12V\n\x13subscription_status\x18\x02 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionStatus\x12\x16\n\x0einstrument_uid\x18\x03 \x01(\t\"\xc4\x01\n\x19SubscribeLastPriceRequest\x12V\n\x13subscription_action\x18\x01 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionAction\x12O\n\x0binstruments\x18\x02 \x03(\x0b\x32:.tinkoff.public.invest.api.contract.v1.LastPriceInstrument\">\n\x13LastPriceInstrument\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12\x15\n\rinstrument_id\x18\x02 \x01(\t\"\x91\x01\n\x1aSubscribeLastPriceResponse\x12\x13\n\x0btracking_id\x18\x01 \x01(\t\x12^\n\x18last_price_subscriptions\x18\x02 \x03(\x0b\x32<.tinkoff.public.invest.api.contract.v1.LastPriceSubscription\"\x95\x01\n\x15LastPriceSubscription\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12V\n\x13subscription_status\x18\x02 \x01(\x0e\x32\x39.tinkoff.public.invest.api.contract.v1.SubscriptionStatus\x12\x16\n\x0einstrument_uid\x18\x03 \x01(\t\"\xea\x03\n\x06\x43\x61ndle\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12M\n\x08interval\x18\x02 \x01(\x0e\x32;.tinkoff.public.invest.api.contract.v1.SubscriptionInterval\x12>\n\x04open\x18\x03 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12>\n\x04high\x18\x04 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12=\n\x03low\x18\x05 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12?\n\x05\x63lose\x18\x06 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x0e\n\x06volume\x18\x07 \x01(\x03\x12(\n\x04time\x18\x08 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x31\n\rlast_trade_ts\x18\t \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x16\n\x0einstrument_uid\x18\n \x01(\t\"\x83\x03\n\tOrderBook\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12\r\n\x05\x64\x65pth\x18\x02 \x01(\x05\x12\x15\n\ris_consistent\x18\x03 \x01(\x08\x12:\n\x04\x62ids\x18\x04 \x03(\x0b\x32,.tinkoff.public.invest.api.contract.v1.Order\x12:\n\x04\x61sks\x18\x05 \x03(\x0b\x32,.tinkoff.public.invest.api.contract.v1.Order\x12(\n\x04time\x18\x06 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x42\n\x08limit_up\x18\x07 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x44\n\nlimit_down\x18\x08 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x16\n\x0einstrument_uid\x18\t \x01(\t\"Z\n\x05Order\x12?\n\x05price\x18\x01 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x10\n\x08quantity\x18\x02 \x01(\x03\"\xf4\x01\n\x05Trade\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12H\n\tdirection\x18\x02 \x01(\x0e\x32\x35.tinkoff.public.invest.api.contract.v1.TradeDirection\x12?\n\x05price\x18\x03 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x10\n\x08quantity\x18\x04 \x01(\x03\x12(\n\x04time\x18\x05 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x16\n\x0einstrument_uid\x18\x06 \x01(\t\"\xfe\x01\n\rTradingStatus\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12T\n\x0etrading_status\x18\x02 \x01(\x0e\x32<.tinkoff.public.invest.api.contract.v1.SecurityTradingStatus\x12(\n\x04time\x18\x03 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\"\n\x1alimit_order_available_flag\x18\x04 \x01(\x08\x12#\n\x1bmarket_order_available_flag\x18\x05 \x01(\x08\x12\x16\n\x0einstrument_uid\x18\x06 \x01(\t\"\xd7\x01\n\x11GetCandlesRequest\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12(\n\x04\x66rom\x18\x02 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12&\n\x02to\x18\x03 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12G\n\x08interval\x18\x04 \x01(\x0e\x32\x35.tinkoff.public.invest.api.contract.v1.CandleInterval\x12\x15\n\rinstrument_id\x18\x05 \x01(\t\"\\\n\x12GetCandlesResponse\x12\x46\n\x07\x63\x61ndles\x18\x01 \x03(\x0b\x32\x35.tinkoff.public.invest.api.contract.v1.HistoricCandle\"\xdf\x02\n\x0eHistoricCandle\x12>\n\x04open\x18\x01 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12>\n\x04high\x18\x02 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12=\n\x03low\x18\x03 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12?\n\x05\x63lose\x18\x04 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x0e\n\x06volume\x18\x05 \x01(\x03\x12(\n\x04time\x18\x06 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x13\n\x0bis_complete\x18\x07 \x01(\x08\"?\n\x14GetLastPricesRequest\x12\x10\n\x04\x66igi\x18\x01 \x03(\tB\x02\x18\x01\x12\x15\n\rinstrument_id\x18\x02 \x03(\t\"^\n\x15GetLastPricesResponse\x12\x45\n\x0blast_prices\x18\x01 \x03(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.LastPrice\"\x9c\x01\n\tLastPrice\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12?\n\x05price\x18\x02 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12(\n\x04time\x18\x03 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x16\n\x0einstrument_uid\x18\x0b \x01(\t\"M\n\x13GetOrderBookRequest\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12\r\n\x05\x64\x65pth\x18\x02 \x01(\x05\x12\x15\n\rinstrument_id\x18\x03 \x01(\t\"\xf3\x04\n\x14GetOrderBookResponse\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12\r\n\x05\x64\x65pth\x18\x02 \x01(\x05\x12:\n\x04\x62ids\x18\x03 \x03(\x0b\x32,.tinkoff.public.invest.api.contract.v1.Order\x12:\n\x04\x61sks\x18\x04 \x03(\x0b\x32,.tinkoff.public.invest.api.contract.v1.Order\x12\x44\n\nlast_price\x18\x05 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x45\n\x0b\x63lose_price\x18\x06 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x42\n\x08limit_up\x18\x07 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x44\n\nlimit_down\x18\x08 \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12\x31\n\rlast_price_ts\x18\x15 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x32\n\x0e\x63lose_price_ts\x18\x16 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x30\n\x0corderbook_ts\x18\x17 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x16\n\x0einstrument_uid\x18\t \x01(\t\"B\n\x17GetTradingStatusRequest\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12\x15\n\rinstrument_id\x18\x02 \x01(\t\"2\n\x19GetTradingStatusesRequest\x12\x15\n\rinstrument_id\x18\x01 \x03(\t\"w\n\x1aGetTradingStatusesResponse\x12Y\n\x10trading_statuses\x18\x01 \x03(\x0b\x32?.tinkoff.public.invest.api.contract.v1.GetTradingStatusResponse\"\x81\x02\n\x18GetTradingStatusResponse\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12T\n\x0etrading_status\x18\x02 \x01(\x0e\x32<.tinkoff.public.invest.api.contract.v1.SecurityTradingStatus\x12\"\n\x1alimit_order_available_flag\x18\x03 \x01(\x08\x12#\n\x1bmarket_order_available_flag\x18\x04 \x01(\x08\x12 \n\x18\x61pi_trade_available_flag\x18\x05 \x01(\x08\x12\x16\n\x0einstrument_uid\x18\x06 \x01(\t\"\x91\x01\n\x14GetLastTradesRequest\x12\x10\n\x04\x66igi\x18\x01 \x01(\tB\x02\x18\x01\x12(\n\x04\x66rom\x18\x02 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12&\n\x02to\x18\x03 \x01(\x0b\x32\x1a.google.protobuf.Timestamp\x12\x15\n\rinstrument_id\x18\x04 \x01(\t\"U\n\x15GetLastTradesResponse\x12<\n\x06trades\x18\x01 \x03(\x0b\x32,.tinkoff.public.invest.api.contract.v1.Trade\"\x14\n\x12GetMySubscriptions\"p\n\x15GetClosePricesRequest\x12W\n\x0binstruments\x18\x01 \x03(\x0b\x32\x42.tinkoff.public.invest.api.contract.v1.InstrumentClosePriceRequest\"4\n\x1bInstrumentClosePriceRequest\x12\x15\n\rinstrument_id\x18\x01 \x01(\t\"s\n\x16GetClosePricesResponse\x12Y\n\x0c\x63lose_prices\x18\x01 \x03(\x0b\x32\x43.tinkoff.public.invest.api.contract.v1.InstrumentClosePriceResponse\"\xaf\x01\n\x1cInstrumentClosePriceResponse\x12\x0c\n\x04\x66igi\x18\x01 \x01(\t\x12\x16\n\x0einstrument_uid\x18\x02 \x01(\t\x12?\n\x05price\x18\x0b \x01(\x0b\x32\x30.tinkoff.public.invest.api.contract.v1.Quotation\x12(\n\x04time\x18\x15 \x01(\x0b\x32\x1a.google.protobuf.Timestamp*\x81\x01\n\x12SubscriptionAction\x12#\n\x1fSUBSCRIPTION_ACTION_UNSPECIFIED\x10\x00\x12!\n\x1dSUBSCRIPTION_ACTION_SUBSCRIBE\x10\x01\x12#\n\x1fSUBSCRIPTION_ACTION_UNSUBSCRIBE\x10\x02*\x8b\x01\n\x14SubscriptionInterval\x12%\n!SUBSCRIPTION_INTERVAL_UNSPECIFIED\x10\x00\x12$\n SUBSCRIPTION_INTERVAL_ONE_MINUTE\x10\x01\x12&\n\"SUBSCRIPTION_INTERVAL_FIVE_MINUTES\x10\x02*\xc5\x03\n\x12SubscriptionStatus\x12#\n\x1fSUBSCRIPTION_STATUS_UNSPECIFIED\x10\x00\x12\x1f\n\x1bSUBSCRIPTION_STATUS_SUCCESS\x10\x01\x12,\n(SUBSCRIPTION_STATUS_INSTRUMENT_NOT_FOUND\x10\x02\x12\x36\n2SUBSCRIPTION_STATUS_SUBSCRIPTION_ACTION_IS_INVALID\x10\x03\x12(\n$SUBSCRIPTION_STATUS_DEPTH_IS_INVALID\x10\x04\x12+\n\'SUBSCRIPTION_STATUS_INTERVAL_IS_INVALID\x10\x05\x12)\n%SUBSCRIPTION_STATUS_LIMIT_IS_EXCEEDED\x10\x06\x12&\n\"SUBSCRIPTION_STATUS_INTERNAL_ERROR\x10\x07\x12)\n%SUBSCRIPTION_STATUS_TOO_MANY_REQUESTS\x10\x08\x12.\n*SUBSCRIPTION_STATUS_SUBSCRIPTION_NOT_FOUND\x10\t*d\n\x0eTradeDirection\x12\x1f\n\x1bTRADE_DIRECTION_UNSPECIFIED\x10\x00\x12\x17\n\x13TRADE_DIRECTION_BUY\x10\x01\x12\x18\n\x14TRADE_DIRECTION_SELL\x10\x02*\x91\x03\n\x0e\x43\x61ndleInterval\x12\x1f\n\x1b\x43\x41NDLE_INTERVAL_UNSPECIFIED\x10\x00\x12\x19\n\x15\x43\x41NDLE_INTERVAL_1_MIN\x10\x01\x12\x19\n\x15\x43\x41NDLE_INTERVAL_5_MIN\x10\x02\x12\x1a\n\x16\x43\x41NDLE_INTERVAL_15_MIN\x10\x03\x12\x18\n\x14\x43\x41NDLE_INTERVAL_HOUR\x10\x04\x12\x17\n\x13\x43\x41NDLE_INTERVAL_DAY\x10\x05\x12\x19\n\x15\x43\x41NDLE_INTERVAL_2_MIN\x10\x06\x12\x19\n\x15\x43\x41NDLE_INTERVAL_3_MIN\x10\x07\x12\x1a\n\x16\x43\x41NDLE_INTERVAL_10_MIN\x10\x08\x12\x1a\n\x16\x43\x41NDLE_INTERVAL_30_MIN\x10\t\x12\x1a\n\x16\x43\x41NDLE_INTERVAL_2_HOUR\x10\n\x12\x1a\n\x16\x43\x41NDLE_INTERVAL_4_HOUR\x10\x0b\x12\x18\n\x14\x43\x41NDLE_INTERVAL_WEEK\x10\x0c\x12\x19\n\x15\x43\x41NDLE_INTERVAL_MONTH\x10\r2\xfd\x07\n\x11MarketDataService\x12\x81\x01\n\nGetCandles\x12\x38.tinkoff.public.invest.api.contract.v1.GetCandlesRequest\x1a\x39.tinkoff.public.invest.api.contract.v1.GetCandlesResponse\x12\x8a\x01\n\rGetLastPrices\x12;.tinkoff.public.invest.api.contract.v1.GetLastPricesRequest\x1a<.tinkoff.public.invest.api.contract.v1.GetLastPricesResponse\x12\x87\x01\n\x0cGetOrderBook\x12:.tinkoff.public.invest.api.contract.v1.GetOrderBookRequest\x1a;.tinkoff.public.invest.api.contract.v1.GetOrderBookResponse\x12\x93\x01\n\x10GetTradingStatus\x12>.tinkoff.public.invest.api.contract.v1.GetTradingStatusRequest\x1a?.tinkoff.public.invest.api.contract.v1.GetTradingStatusResponse\x12\x99\x01\n\x12GetTradingStatuses\x12@.tinkoff.public.invest.api.contract.v1.GetTradingStatusesRequest\x1a\x41.tinkoff.public.invest.api.contract.v1.GetTradingStatusesResponse\x12\x8a\x01\n\rGetLastTrades\x12;.tinkoff.public.invest.api.contract.v1.GetLastTradesRequest\x1a<.tinkoff.public.invest.api.contract.v1.GetLastTradesResponse\x12\x8d\x01\n\x0eGetClosePrices\x12<.tinkoff.public.invest.api.contract.v1.GetClosePricesRequest\x1a=.tinkoff.public.invest.api.contract.v1.GetClosePricesResponse2\xcd\x02\n\x17MarketDataStreamService\x12\x8b\x01\n\x10MarketDataStream\x12\x38.tinkoff.public.invest.api.contract.v1.MarketDataRequest\x1a\x39.tinkoff.public.invest.api.contract.v1.MarketDataResponse(\x01\x30\x01\x12\xa3\x01\n\x1aMarketDataServerSideStream\x12H.tinkoff.public.invest.api.contract.v1.MarketDataServerSideStreamRequest\x1a\x39.tinkoff.public.invest.api.contract.v1.MarketDataResponse0\x01\x42\x61\n\x1cru.tinkoff.piapi.contract.v1P\x01Z\x0c./;investapi\xa2\x02\x05TIAPI\xaa\x02\x14Tinkoff.InvestApi.V1\xca\x02\x11Tinkoff\\Invest\\V1b\x06proto3')

_globals = globals()
_builder.BuildMessageAndEnumDescriptors(DESCRIPTOR, _globals)
_builder.BuildTopDescriptorsAndMessages(DESCRIPTOR, 'tinkoff.invest.grpc.marketdata_pb2', _globals)
if not _descriptor._USE_C_DESCRIPTORS:
  _globals['DESCRIPTOR']._loaded_options = None
  _globals['DESCRIPTOR']._serialized_options = b'\n\034ru.tinkoff.piapi.contract.v1P\001Z\014./;investapi\242\002\005TIAPI\252\002\024Tinkoff.InvestApi.V1\312\002\021Tinkoff\\Invest\\V1'
  _globals['_CANDLEINSTRUMENT'].fields_by_name['figi']._loaded_options = None
  _globals['_CANDLEINSTRUMENT'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_ORDERBOOKINSTRUMENT'].fields_by_name['figi']._loaded_options = None
  _globals['_ORDERBOOKINSTRUMENT'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_TRADEINSTRUMENT'].fields_by_name['figi']._loaded_options = None
  _globals['_TRADEINSTRUMENT'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_INFOINSTRUMENT'].fields_by_name['figi']._loaded_options = None
  _globals['_INFOINSTRUMENT'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_LASTPRICEINSTRUMENT'].fields_by_name['figi']._loaded_options = None
  _globals['_LASTPRICEINSTRUMENT'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_GETCANDLESREQUEST'].fields_by_name['figi']._loaded_options = None
  _globals['_GETCANDLESREQUEST'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_GETLASTPRICESREQUEST'].fields_by_name['figi']._loaded_options = None
  _globals['_GETLASTPRICESREQUEST'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_GETORDERBOOKREQUEST'].fields_by_name['figi']._loaded_options = None
  _globals['_GETORDERBOOKREQUEST'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_GETTRADINGSTATUSREQUEST'].fields_by_name['figi']._loaded_options = None
  _globals['_GETTRADINGSTATUSREQUEST'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_GETLASTTRADESREQUEST'].fields_by_name['figi']._loaded_options = None
  _globals['_GETLASTTRADESREQUEST'].fields_by_name['figi']._serialized_options = b'\030\001'
  _globals['_SUBSCRIPTIONACTION']._serialized_start=9616
  _globals['_SUBSCRIPTIONACTION']._serialized_end=9745
  _globals['_SUBSCRIPTIONINTERVAL']._serialized_start=9748
  _globals['_SUBSCRIPTIONINTERVAL']._serialized_end=9887
  _globals['_SUBSCRIPTIONSTATUS']._serialized_start=9890
  _globals['_SUBSCRIPTIONSTATUS']._serialized_end=10343
  _globals['_TRADEDIRECTION']._serialized_start=10345
  _globals['_TRADEDIRECTION']._serialized_end=10445
  _globals['_CANDLEINTERVAL']._serialized_start=10448
  _globals['_CANDLEINTERVAL']._serialized_end=10849
  _globals['_MARKETDATAREQUEST']._serialized_start=147
  _globals['_MARKETDATAREQUEST']._serialized_end=775
  _globals['_MARKETDATASERVERSIDESTREAMREQUEST']._serialized_start=778
  _globals['_MARKETDATASERVERSIDESTREAMREQUEST']._serialized_end=1310
  _globals['_MARKETDATARESPONSE']._serialized_start=1313
  _globals['_MARKETDATARESPONSE']._serialized_end=2273
  _globals['_SUBSCRIBECANDLESREQUEST']._serialized_start=2276
  _globals['_SUBSCRIBECANDLESREQUEST']._serialized_end=2490
  _globals['_CANDLEINSTRUMENT']._serialized_start=2493
  _globals['_CANDLEINSTRUMENT']._serialized_end=2631
  _globals['_SUBSCRIBECANDLESRESPONSE']._serialized_start=2634
  _globals['_SUBSCRIBECANDLESRESPONSE']._serialized_end=2771
  _globals['_CANDLESUBSCRIPTION']._serialized_start=2774
  _globals['_CANDLESUBSCRIPTION']._serialized_end=2999
  _globals['_SUBSCRIBEORDERBOOKREQUEST']._serialized_start=3002
  _globals['_SUBSCRIBEORDERBOOKREQUEST']._serialized_end=3198
  _globals['_ORDERBOOKINSTRUMENT']._serialized_start=3200
  _globals['_ORDERBOOKINSTRUMENT']._serialized_end=3277
  _globals['_SUBSCRIBEORDERBOOKRESPONSE']._serialized_start=3280
  _globals['_SUBSCRIBEORDERBOOKRESPONSE']._serialized_end=3425
  _globals['_ORDERBOOKSUBSCRIPTION']._serialized_start=3428
  _globals['_ORDERBOOKSUBSCRIPTION']._serialized_end=3592
  _globals['_SUBSCRIBETRADESREQUEST']._serialized_start=3595
  _globals['_SUBSCRIBETRADESREQUEST']._serialized_end=3784
  _globals['_TRADEINSTRUMENT']._serialized_start=3786
  _globals['_TRADEINSTRUMENT']._serialized_end=3844
  _globals['_SUBSCRIBETRADESRESPONSE']._serialized_start=3847
  _globals['_SUBSCRIBETRADESRESPONSE']._serialized_end=3980
  _globals['_TRADESUBSCRIPTION']._serialized_start=3983
  _globals['_TRADESUBSCRIPTION']._serialized_end=4128
  _globals['_SUBSCRIBEINFOREQUEST']._serialized_start=4131
  _globals['_SUBSCRIBEINFOREQUEST']._serialized_end=4317
  _globals['_INFOINSTRUMENT']._serialized_start=4319
  _globals['_INFOINSTRUMENT']._serialized_end=4376
  _globals['_SUBSCRIBEINFORESPONSE']._serialized_start=4379
  _globals['_SUBSCRIBEINFORESPONSE']._serialized_end=4508
  _globals['_INFOSUBSCRIPTION']._serialized_start=4511
  _globals['_INFOSUBSCRIPTION']._serialized_end=4655
  _globals['_SUBSCRIBELASTPRICEREQUEST']._serialized_start=4658
  _globals['_SUBSCRIBELASTPRICEREQUEST']._serialized_end=4854
  _globals['_LASTPRICEINSTRUMENT']._serialized_start=4856
  _globals['_LASTPRICEINSTRUMENT']._serialized_end=4918
  _globals['_SUBSCRIBELASTPRICERESPONSE']._serialized_start=4921
  _globals['_SUBSCRIBELASTPRICERESPONSE']._serialized_end=5066
  _globals['_LASTPRICESUBSCRIPTION']._serialized_start=5069
  _globals['_LASTPRICESUBSCRIPTION']._serialized_end=5218
  _globals['_CANDLE']._serialized_start=5221
  _globals['_CANDLE']._serialized_end=5711
  _globals['_ORDERBOOK']._serialized_start=5714
  _globals['_ORDERBOOK']._serialized_end=6101
  _globals['_ORDER']._serialized_start=6103
  _globals['_ORDER']._serialized_end=6193
  _globals['_TRADE']._serialized_start=6196
  _globals['_TRADE']._serialized_end=6440
  _globals['_TRADINGSTATUS']._serialized_start=6443
  _globals['_TRADINGSTATUS']._serialized_end=6697
  _globals['_GETCANDLESREQUEST']._serialized_start=6700
  _globals['_GETCANDLESREQUEST']._serialized_end=6915
  _globals['_GETCANDLESRESPONSE']._serialized_start=6917
  _globals['_GETCANDLESRESPONSE']._serialized_end=7009
  _globals['_HISTORICCANDLE']._serialized_start=7012
  _globals['_HISTORICCANDLE']._serialized_end=7363
  _globals['_GETLASTPRICESREQUEST']._serialized_start=7365
  _globals['_GETLASTPRICESREQUEST']._serialized_end=7428
  _globals['_GETLASTPRICESRESPONSE']._serialized_start=7430
  _globals['_GETLASTPRICESRESPONSE']._serialized_end=7524
  _globals['_LASTPRICE']._serialized_start=7527
  _globals['_LASTPRICE']._serialized_end=7683
  _globals['_GETORDERBOOKREQUEST']._serialized_start=7685
  _globals['_GETORDERBOOKREQUEST']._serialized_end=7762
  _globals['_GETORDERBOOKRESPONSE']._serialized_start=7765
  _globals['_GETORDERBOOKRESPONSE']._serialized_end=8392
  _globals['_GETTRADINGSTATUSREQUEST']._serialized_start=8394
  _globals['_GETTRADINGSTATUSREQUEST']._serialized_end=8460
  _globals['_GETTRADINGSTATUSESREQUEST']._serialized_start=8462
  _globals['_GETTRADINGSTATUSESREQUEST']._serialized_end=8512
  _globals['_GETTRADINGSTATUSESRESPONSE']._serialized_start=8514
  _globals['_GETTRADINGSTATUSESRESPONSE']._serialized_end=8633
  _globals['_GETTRADINGSTATUSRESPONSE']._serialized_start=8636
  _globals['_GETTRADINGSTATUSRESPONSE']._serialized_end=8893
  _globals['_GETLASTTRADESREQUEST']._serialized_start=8896
  _globals['_GETLASTTRADESREQUEST']._serialized_end=9041
  _globals['_GETLASTTRADESRESPONSE']._serialized_start=9043
  _globals['_GETLASTTRADESRESPONSE']._serialized_end=9128
  _globals['_GETMYSUBSCRIPTIONS']._serialized_start=9130
  _globals['_GETMYSUBSCRIPTIONS']._serialized_end=9150
  _globals['_GETCLOSEPRICESREQUEST']._serialized_start=9152
  _globals['_GETCLOSEPRICESREQUEST']._serialized_end=9264
  _globals['_INSTRUMENTCLOSEPRICEREQUEST']._serialized_start=9266
  _globals['_INSTRUMENTCLOSEPRICEREQUEST']._serialized_end=9318
  _globals['_GETCLOSEPRICESRESPONSE']._serialized_start=9320
  _globals['_GETCLOSEPRICESRESPONSE']._serialized_end=9435
  _globals['_INSTRUMENTCLOSEPRICERESPONSE']._serialized_start=9438
  _globals['_INSTRUMENTCLOSEPRICERESPONSE']._serialized_end=9613
  _globals['_MARKETDATASERVICE']._serialized_start=10852
  _globals['_MARKETDATASERVICE']._serialized_end=11873
  _globals['_MARKETDATASTREAMSERVICE']._serialized_start=11876
  _globals['_MARKETDATASTREAMSERVICE']._serialized_end=12209
# @@protoc_insertion_point(module_scope)
