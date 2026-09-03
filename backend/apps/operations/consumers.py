from channels.generic.websocket import AsyncJsonWebsocketConsumer


class TripConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close()
            return
        self.trip_id = self.scope["url_route"]["kwargs"]["trip_id"]
        self.group = f"trip_{self.trip_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def ops_message(self, event):
        await self.send_json(event["body"])


class DistrictOperationsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if user is None or not user.is_authenticated:
            await self.close()
            return
        self.district_id = self.scope["url_route"]["kwargs"]["district_id"]
        if user.role != "platform_admin" and str(user.district_id) != str(self.district_id):
            await self.close()
            return
        self.group = f"district_{self.district_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def ops_message(self, event):
        await self.send_json(event["body"])
